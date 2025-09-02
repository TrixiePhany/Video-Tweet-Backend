import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    //create 
    if (!content || !content.trim()) {
    throw new ApiError(400, "Tweet content is required");
  }
  if (!req.user?._id) {
    throw new ApiError(401, "Unauthorized: please log in to tweet");
  }

  // Create 
  const tweet = await Tweet.create({
    content: content.trim(),
    owner: req.user._id,
  });

  if (!tweet) {
    throw new ApiError(500, "Failed to create tweet");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
    //user tweets
    const { userId } = req.params;
    if(!mongoose.isValidObjectId(userId)){
        throw new ApiError(400, "Invalid userId");
    }
    const user = await User.findById(userId);
    if(!user){
        throw new ApiError(404, "User not found");
    }
    const tweets = await Tweet.find({ owner: userId })
    .populate("owner", "fullname username avatar") 
    .sort({ createdAt: -1 })
    .lean();

    if (!tweets.length) {
        throw new ApiError(404, "No tweets found for this user");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
});

const updateTweet = asyncHandler(async (req, res) => {
    //update tweet
    const { tweetId } = req.params;
    const { content } = req.body;

    if(!mongoose.isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweetId");
    }
    if (!content || !content.trim()) {
        throw new ApiError(400, "Tweet content is required");
    }
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized: please log in to update tweet");
    }
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(404, "Tweet not found");

    if (String(tweet.owner) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to update this tweet");
    }
    tweet.content = content.trim();
    const updatedTweet = await tweet.save();

    return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));

});

const deleteTweet = asyncHandler(async (req, res) => {
    //delete tweet
    const { tweetId } = req.params;
    if(!mongoose.isValidObjectId(tweetId)){
        throw new ApiError(400, "Invalid tweetId");
    }
    if (!req.user?._id) {
        throw new ApiError(401, "Unauthorized: please log in to delete tweet");
    }
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(404, "Tweet not found"); 
    if (String(tweet.owner) !== String(req.user?._id)) {
    throw new ApiError(403, "You are not authorized to delete this tweet");
  }
  await tweet.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Tweet deleted successfully"));
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}