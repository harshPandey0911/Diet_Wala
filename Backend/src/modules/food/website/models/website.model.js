import mongoose from 'mongoose';

// One document ({ key: 'main' }) holding the texts of the website (desktop) view of the user app.
const websiteContentSchema = new mongoose.Schema(
    {
        key: { type: String, default: 'main', unique: true },
        content: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { collection: 'food_website_content', timestamps: true, minimize: false }
);

export const FoodWebsiteContent = mongoose.model('FoodWebsiteContent', websiteContentSchema);
