import mongoose, {Schema} from 'mongoose';

const tweetSchema = new Schema({
    content:{
        type: String,
        required: true,
    },
    owner:{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
},{timestamps: true});

tweetSchema.index({ createdAt: -1 });
tweetSchema.index({ content: "text" });

export const Tweet = mongoose.model('Tweet', tweetSchema);