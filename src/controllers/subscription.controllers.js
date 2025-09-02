import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const MAX_LIMIT = 100;

const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    //toggle subscription
    if(!mongoose.isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid channelId")
    }
    if(channelId === req.user?._id.toString()){
        throw new ApiError(400, "You cannot subscribe to yourself")
    }

    const channel = await User.findById(channelId)
    if(!channel){
        throw new ApiError(404, "Channel not found")
    }
    const existing = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });
   if (existing) {
    await existing.deleteOne();
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Unsubscribed successfully"));
  }
  const sub = await Subscription.create({
    subscriber: req.user._id,
    channel: channelId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, sub, "Subscribed successfully"));
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    let { page = 1, limit = 10 } = req.query;
    if(!mongoose.isValidObjectId(channelId)){
        throw new ApiError(400, "Invalid channelId")
    }
    page = Math.max(parseInt(page, 10) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), MAX_LIMIT);

    const filter = { channel: mongoose.Types.ObjectId(channelId) };
    const totalDocs = await Subscription.countDocuments(filter);
    // fetch subscribers (newest first)
    const subscribers = await Subscription.find(filter)
    .populate({ path: "subscriber", select: "fullname username avatar" })
    .sort({ createdAt: -1, _id: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

    const totalPages = Math.max(Math.ceil(totalDocs / limit), 1);
    const channel = await User.findById(channelId)
    if(!channel){
        throw new ApiError(404, "Channel not found")
    }
    return res.status(200).json(
    new ApiResponse(200,
      {
        page,
        limit,
        totalDocs,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        subscribers, // array of subscribers
      },
      "Channel subscribers fetched successfully"
    )
  );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    let { page = 1, limit = 10 } = req.query;
  if (!mongoose.isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriberId");
  }
  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), MAX_LIMIT);
  const filter = { subscriber: new mongoose.Types.ObjectId(subscriberId) };

  const totalDocs = await Subscription.countDocuments(filter);

  const channels = await Subscription.find(filter)
    .populate({ path: "channel", select: "fullname username avatar" })
    .sort({ createdAt: -1, _id: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalPages = Math.max(Math.ceil(totalDocs / limit), 1);
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        page,
        limit,
        totalDocs,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        channels, 
      },
      "Subscribed channels fetched successfully"
    )
  );
})

export {toggleSubscription, getUserChannelSubscribers,
    getSubscribedChannels}