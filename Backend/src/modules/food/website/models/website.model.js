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

// Messages sent from the contact form of the public website.
const websiteEnquirySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, maxlength: 100 },
        phone: { type: String, required: true, maxlength: 20 },
        message: { type: String, required: true, maxlength: 1500 },
        status: { type: String, enum: ['new', 'read'], default: 'new', index: true },
        ip: { type: String, default: '' }
    },
    { collection: 'food_website_enquiries', timestamps: true }
);

export const FoodWebsiteEnquiry = mongoose.model('FoodWebsiteEnquiry', websiteEnquirySchema);
