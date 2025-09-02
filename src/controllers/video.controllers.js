import mongoose from "mongoose";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.model.js"; 

const SORT_FIELDS = new Set(["createdAt", "updatedAt", "views", "duration", "title"]);
const MAX_LIMIT = 100;

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), MAX_LIMIT);
  if (limit > MAX_LIMIT) throw new ApiError(400, `Limit cannot exceed ${MAX_LIMIT}`);

  const sortField = SORT_FIELDS.has(sortBy) ? sortBy : "createdAt";
  const direction =
    (typeof sortType === "string" && sortType.toLowerCase() === "asc") || sortType === "1"
      ? 1
      : -1;
  const sort = { [sortField]: direction, _id: 1 };

  const match = { isPublished: true };
  if (userId) {
    if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid userId");
    match.owner = mongoose.Types.ObjectId(userId);
  }

  const pipeline = [{ $match: match }];

  if (query && query.trim()) {
    const q = query.trim();
    pipeline.push({ $match: { $text: { $search: q } } });
    pipeline.push({ $addFields: { _score: { $meta: "textScore" } } });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { fullname: 1, username: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$owner" },
    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        title: 1,
        description: 1,
        views: 1,
        duration: 1,
        isPublished: 1,
        createdAt: 1,
        owner: 1,
        _score: 1, 
      },
    },
    ...(query?.trim()
      ? [{ $sort: { _score: { $meta: "textScore" }, ...sort } }]
      : [{ $sort: sort }])
  );

  const agg = Video.aggregate(pipeline);
  const videos = await Video.aggregatePaginate(agg, { page, limit });

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
    if(!title || !description){
        throw new ApiError(400, "Title and description are required")
    }
    if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized");
    }
    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbLocalPath = req.files?.thumbnail?.[0]?.path;
    if(!videoLocalPath || !thumbLocalPath){
        throw new ApiError(400, "Video file and thumbnail are required")
    }
    // upload to cloudinary
    let uploadedVideo, uploadedThumb;
        try {
            uploadedVideo = await uploadOnCloudinary(videoLocalPath, { resource_type: "video" });
            uploadedThumb = await uploadOnCloudinary(thumbLocalPath);
        } catch (error) {
            console.log("Cloudinary upload error: ", error);
            throw new ApiError(500, "Upload to Cloudinary failed");
        }
    if (!uploadedVideo?.url || !uploadedThumb?.url) {
        if (uploadedVideo?.public_id) await deleteFromCloudinary(uploadedVideo.public_id, "video");
        if (uploadedThumb?.public_id) await deleteFromCloudinary(uploadedThumb.public_id, "image");
        throw new ApiError(500, "Cloudinary upload incomplete");
    }
    const finalDuration =
    typeof duration !== "undefined" && duration !== null
      ? Number(duration)
      : (Number(uploadedVideo?.duration) || undefined);

  if (!finalDuration || Number.isNaN(finalDuration)) {
    await deleteFromCloudinary(uploadedVideo.public_id, "video");
    await deleteFromCloudinary(uploadedThumb.public_id, "image");
    throw new ApiError(400, "duration is required (or must be derivable from the uploaded video)");
  }
  try {
    const doc = await Video.create({
      videoFile: uploadedVideo.url,
      thumbnail: uploadedThumb.url,
      title: title.trim(),
      description: description.trim(),
      duration: finalDuration,
      owner: req.user._id,
      isPublished: true,
    });

    return res
      .status(201)
      .json(new ApiResponse(201, doc, "Video published successfully"));
  } catch (err) {
    if (uploadedVideo?.public_id) await deleteFromCloudinary(uploadedVideo.public_id, "video");
    if (uploadedThumb?.public_id) await deleteFromCloudinary(uploadedThumb.public_id, "image");
    throw new ApiError(500, "Failed to create video record; uploads rolled back");
  }

});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }
    const video = await Video.findById(videoId)
    .populate({ path: "owner", select: "fullname username avatar" })
    .lean();

    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    if (!video.isPublished && (!req.user || String(req.user._id) !== String(video.owner._id))) {
        throw new ApiError(403, "Access denied to unpublished video");
    }
      return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
    
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized");
    }
    const video = await Video.findById(videoId);
        if (!video) throw new ApiError(404, "Video not found");

    //ownership config
    if (String(video.owner) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const { title, description } = req.body;
  let updatedFields = {};

  if (title) updatedFields.title = title.trim();
  if (description) updatedFields.description = description.trim();

  const thumbLocalPath = req.file?.path;
  if (thumbLocalPath) {
    try {
      const uploadedThumb = await uploadOnCloudinary(thumbLocalPath);

      if (!uploadedThumb?.url) {
        throw new ApiError(500, "Thumbnail upload failed");
      }
        if (video.thumbnail) {
            const existingPublicId = extractPublicIdFromUrl(video.thumbnail);
            if (existingPublicId) {
            await deleteFromCloudinary(existingPublicId, "image");
            }
        }
      updatedFields.thumbnail = uploadedThumb.url;
    } catch (error) {
      throw new ApiError(500, "Error uploading new thumbnail");
    }
  }
    if (Object.keys(updatedFields).length === 0) {
        throw new ApiError(400, "No valid fields provided for update");
    }

    const updatedVideo = await Video.findByIdAndUpdate(videoId, { $set: updatedFields }, { new: true })
    .select("-__v") 
    .populate({ path: "owner", select: "fullname username avatar" });

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));

});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
    if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
    }

    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");

  // Ownership check
    if (String(video.owner) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }
  await video.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }
  const video = await Video.findById(videoId);
  if (!video) throw new ApiError(404, "Video not found");
    if (String(video.owner) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to change publish status of this video");
  }
    video.isPublished = !video.isPublished;
  await video.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { id: video._id, isPublished: video.isPublished },
        `Video ${video.isPublished ? "published" : "unpublished"} successfully`
      )
    );
});

export {getAllVideos, publishAVideo, getVideoById, updateVideo, deleteVideo, togglePublishStatus};
