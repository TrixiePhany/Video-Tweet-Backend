import mongoose, {Schema} from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const videoSchema = new Schema ({
    videoFile:{
        type: String,
        required: true,
        trim: true,
        match: [/^https?:\/\/.+/i, 'videoFile must be a URL'],
    }, 
    thumbnail:{
        type: String,
        required: true,
        trim: true,
    },
    title:{
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 160,
    }, 
    description:{
        type: String,
        required: true,
        trim: true,
        maxlength: 7000,
    },
    views:{
        type: Number,
        default: 0
    },
     duration:{
        type: Number,
        required: true,
        min:0
    },
    isPublished:{
        type: Boolean,
        default: false,
        index: true,
    },
    owner:{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    }

},
{
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  });

// Text index for search (title/description)
videoSchema.index({ title: 'text', description: 'text' })

// Common sort/filter combos
videoSchema.index({ owner: 1, createdAt: -1 })
videoSchema.index({ createdAt: -1 })
videoSchema.index({ views: -1 })


videoSchema.plugin(mongooseAggregatePaginate);

export const Video= mongoose.model('Video', videoSchema);