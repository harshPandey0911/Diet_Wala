import mongoose from 'mongoose';
import { FoodLandingSettings } from '../src/modules/food/landing/models/landingSettings.model.js';
import { config } from '../src/config/env.js';

async function updateImages() {
    try {
        console.log('Connecting to DB at:', config.mongodbUri);
        await mongoose.connect(config.mongodbUri);
        console.log('Connected to database.');

        const settings = await FoodLandingSettings.findOne();
        if (settings) {
            settings.heroSlides = [
                {
                    id: 1,
                    type: 'image',
                    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2070&auto=format&fit=crop",
                    title: "Master Chef",
                    subtitle: "Experience the art of fine dining"
                },
                {
                    id: 2,
                    type: 'image',
                    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop",
                    title: "Exquisite Taste",
                    subtitle: "High-class Professional Service"
                },
                {
                    id: 3,
                    type: 'image',
                    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop",
                    title: "Tradition & Passion",
                    subtitle: "Only the best ingredients for our dishes"
                }
            ];
            await settings.save();
            console.log('Successfully updated landing page hero slide images in the database.');
        } else {
            console.log('No settings document found in DB, skipping update.');
        }
    } catch (err) {
        console.error('Error updating images:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

updateImages();
