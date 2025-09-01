import {asyncHandler} from "../utils/asyncHandler.js";
import {User} from "../models/user.models.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken= async (userId) =>{
    try {
        const user = await User.findById(userId)
        if(!user) throw new ApiError(404, "User not found while generating tokens")
    
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
    
        user.refreshToken = refreshToken
        await user.save({validationBeforeSave: false})
        return({accessToken, refreshToken})
    } catch (error) {
        throw new ApiError(500, "Token generation failed" + error.message)    
    }

}
const registerUser = asyncHandler(async (req, res) =>{
    const {fullname, email, username, password}=req.body
    //validation
    if(!fullname || !email || !username || !password){
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        })
    }
    const existedUser = await User.findOne({$or: [{email}, {username}]})
    if(existedUser){
        return res.status(409).json({
            success: false,
            message: "User already exists"
        })
    }
    console.warn(req.files)
    const avatarLocalPath = req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.["cover-image"]?.[0]?.path

    if(!avatarLocalPath){
        return res.status(400).json({
            success: false,
            message: "Avatar is required"
        })
    }
    //uploading on cloudinary
    //const coverImage = coverLocalPath ? await uploadToCloudinary(coverLocalPath) : undefined;

    let avatar;
    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Avatar uploaded to cloudinary: ", avatar)
    } catch (error) {
        console.log("Error uploading to cloudinary", error)
        throw new ApiError(500, "Image upload failed or missing")
    }
    let coverImage;
    if(coverLocalPath){
    try {
        coverImage = await uploadOnCloudinary(coverLocalPath);
        console.log("cover uploaded to cloudinary: ", coverImage)
    } catch (error) {
        console.log("Error uploading to cloudinary", error)
        throw new ApiError(500, "Image upload failed or missing")
    }
}
    //create user
try {
        const user = await User.create({
            fullname,
            email, 
            username: username.toLowerCase(), 
            password, 
            avatar: avatar.url, 
            coverImage: coverImage?.url,
        })
        const createdUser =await User.findById(user._id).select(
            "-password -refreshToken"
        )
        if(!createdUser)    {
            return res.status(500).json({
                success: false,
                message: "User creation failed while registering"
            })
        }
        return res.status(201).json({       
            success: true,
            message: "User registered successfully",
            user: createdUser
        })
} 
catch (error) {
    console.log("Error creating user", error)
    // If avatar upload succeeded but user creation failed, delete the uploaded avatar
    if (avatar?.public_id) await deleteFromCloudinary(avatar.public_id);
    if (coverImage?.public_id) await deleteFromCloudinary(coverImage.public_id);
    throw new ApiError(500, "User creation failed while registering and images deleted");
}
})

const loginUser = asyncHandler(async (req, res)=>{
    const {email, password, username }= req.body
    //validating 
    if((!email && !username) || !password){
        throw new ApiError(400, "Email or username and password are required")
    }
    const user= await User.findOne({
        $or:[{email}, {username}]
    }
    )
    if (!user){
        throw new ApiError(404, "User not found")
    }
    const isPasswordCorrect = await user.isPasswordCorrect(password)
    if(!isPasswordCorrect){
            throw new ApiError(401, "Invalid credentials")
        }

    const{accessToken, refreshToken}= await 
    generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!loggedInUser){
        throw new ApiError(500, "User login failed")
    }
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    }
    return res.status
    .cookie("AccessToken", accessToken, options)
    .cookie("RefreshToken", refreshToken, options)
    .json({
        success: true,
        message: "User logged in successfully",
        user: loggedInUser, accessToken, refreshToken})
})

const logoutUser = asyncHandler(async (req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken: undefined
            }
        },
        {
            new: true,
        }
    )
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }
    return res
    .status(200)
    .clearCookie("AccessToken", options)
    .clearCookie("RefreshToken", options)
    .json({
        success: true,
        message: "User logged out successfully"
    })
})

const refreshAccessToken = asyncHandler(async (req, res)=>{
    const incomingRefreshToken = req.cookies?.RefreshToken || req.body?.refreshToken
    if(!incomingRefreshToken){{
        throw new ApiError(400, "Refresh token is required, and not getting generated")
    }
}
try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET, )
    const user = await User.findById(decodedToken?._Id)
    if(!user || user.refreshToken !== incomingRefreshToken){
        throw new ApiError(403, "Invalid refresh token")
    }
    const options ={
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }
    const {accessToken, refreshToken:newRefreshToken}= await generateAccessAndRefreshToken(user._id)

    return res
    .status(200)
    .cookie("AccessToken", accessToken, options)
    .cookie("RefreshToken", newRefreshToken, options)
    .json({
        success: true,
        message: "Access token refreshed successfully",
        accessToken,
        refreshToken: newRefreshToken
    });
} catch (error) {
    throw new ApiError(403, "Invalid refresh token" + error.message)
}
})

const changeCurrentPassword= asyncHandler(async(req, res)=>{
    const {oldPassword, newPassword}= req.body
    const user= await User.findById(req.user?._id)
    const isPasswordValid = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordValid){
        throw new ApiError(400, "Old password is incorrect")
    }
    user.password = newPassword
    const updatedPasswordUser= await user.save({validationBeforeSave: false })
    if(!oldPassword || !newPassword){
        throw new ApiError(400, "Old and new password are required")
    }       
    return res.status(200).json({
        success: true,
        message: "Password changed successfully",
    }   )
})

const getCurrentUser= asyncHandler(async(req, res)=>{
    return res.status(200).json({
        success: true,
        user: req.user
    })
})

const updateAccountDetails= asyncHandler(async(req, res)=>{
    const {fullname, email}= req.body
    if(!fullname || !email){
        throw new ApiError(400, "Fullname and username are required")
    }
    User.findById().select("-password -refreshToken")
    const existedUser = await User.findByIdAndUpdate(
        req.user?._id,{
            $set:   {fullname, email}   
        },{
            new: true,
        }
    ).select("-password -refreshToken")

    return res.status(200).json( new ApiResponse(200, 
    true, "Account details updated successfully", existedUser))
})

const updateUserAvatar= asyncHandler(async(req, res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar image is required")
    }
    let avatar;
    try {
        const avatar = await uploadOnCloudinary(avatarLocalPath);
        console.log("Avatar uploaded to cloudinary: ", avatar)
    } catch (error) {
        console.log("Error uploading to cloudinary", error)
        throw new ApiError(500, "Image upload failed or missing")
    }
    if(!avatar.url){
        throw new ApiError(500, "Avatar upload failed")
    }
    const user =await User.findByIdAndUpdate(
        req.user?._id,{
            $set: {avatar: avatar.url}  
        }
        ,{new: true}    
    ).select("-password -refreshToken")
    return res.status(200).json({
        success: true,
        message: "Avatar updated successfully"    }
    )
})

const updateUserCoverImage= asyncHandler(async(req, res)=>{
    const coverLocalPath = req.file?.path
    if(!coverLocalPathLocalPath){
        throw new ApiError(400, "Cover image is required")
    }
    let cover;
    try {
        const cover = await uploadOnCloudinary(coverLocalPath);
        console.log("Cover uploaded to cloudinary: ", cover)
    } catch (error) {
        console.log("Error uploading to cloudinary", error)
        throw new ApiError(500, "Image upload failed or missing")
    }
    if(!avatar.url){
        throw new ApiError(500, "Cover upload failed")
    }
    const user =await User.findByIdAndUpdate(
        req.user?._id,{
            $set: {cover: cover.url}  
        }
        ,{new: true}    
    ).select("-password -refreshToken")
    return res.status(200).json({
        success: true,
        message: "Cover updated successfully"}
    )
})

const getUserChannelProfile = asyncHandler(async (req, res) =>{
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(400, "Username is required")
    }
    const channel = await User.aggregate([
        {
            $match: {username: username.trim().toLowerCase()}
        },
        {
            $lookup :{
                from: "subscritions",
                localField: "_id",
                foreignField: "channelId",
                as: "subscribers"
            }
        },
        {
        $lookup :{
                from: "subscritions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscriberedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{ $size: "$subscribers" },
                subscriberedToCount: { $size: "$subscriberedTo" },
                isSubscribed: {
                    $cond:{
                    if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                    then : true,
                    else: false 
                }
            }
            }
        },
        {
            $project: {
                password: 0,
                refreshToken: 0,
                __v: 0,
                subscribers: 0,
                subscriberedTo: 0,
                email: 1,
                fullname: 1,
                username: 1,
                avatar:1,
                coverImage: 1,
                subscribersCount:1,
                subscriberedToCount: 1,
                isSubscribed: 1,
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404, "Channel not found")
    }
    return res.status(2002).json( new ApiResponse(200, true, "Channel found", channel[0]))
});


const getWatchHistory = asyncHandler(async (req, res) =>{
    const user= await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from: "videos",
                            localField:"watchHistory",
                            foreignField: "_id",
                            as: "watchHistory",
                            pipeline:[
                                {
                                    $lookup:{
                                        from: "users",
                                        localField: "owner",
                                        foreignField: "_id",
                                        as: "owner",
                                        pipeline:[
                                            {
                                                $project:{
                                                   fullname:1,
                                                   username:1,
                                                   avatar:1
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    $addFields:{
                                        owner:{
                                            $first: "$owner"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ])
    if(!user?.length){
        throw new ApiError(404, "User not found")
    }
    return res.status(200).json(new ApiResponse(200, true, "Watch history fetched", user[0]?.watchHistory))
});

export {registerUser, loginUser, refreshAccessToken, logoutUser, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory}