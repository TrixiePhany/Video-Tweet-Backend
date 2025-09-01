import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
//configure cloudinary with env variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: 'auto',
        })
        console.log("File uploaded Cloudinary :"+ response.url);
        await fs.promises.unlink(localFilePath);
        return response
    } catch (error) {
        try { await fs.promises.unlink(localFilePath); } catch {}
        console.log("Error uploading to Cloudinary:", error);
        return null;
    }
}

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId)
        console.log("File deleted from cloudinary", result)
    } catch (error) {
        console.log("Error deleting from cloudinary", error)
        return null
    }
}

export {uploadOnCloudinary, deleteFromCloudinary}