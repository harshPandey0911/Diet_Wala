import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { FoodRestaurant } from './restaurant/models/restaurant.model.js';
import { FoodItem } from './admin/models/food.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://harshpandey09112004_db_user:RQz3mzvRBroXFhe6@dietwala.tyfgjf6.mongodb.net/DietWala?appName=DietWala';

const ACTIVE_ZONE_ID = '6a522adb9f119af1e6b1287c';

const sampleRestaurants = [
  {
    restaurantName: 'FitBites Protein Kitchen',
    ownerName: 'Rahul Sharma',
    ownerEmail: 'fitbites@dietwala.com',
    ownerPhone: '9876543210',
    primaryContactNumber: '9876543210',
    pureVegRestaurant: false,
    zoneId: ACTIVE_ZONE_ID,
    status: 'approved',
    isAvailable: true,
    rating: 4.8,
    ratingCount: 142,
    cuisines: ['High Protein', 'Muscle Gain', 'Salads'],
    minOrderAmount: 140,
    estimatedDeliveryTime: '25-30 min',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    addressLine1: 'South Tukoganj',
    city: 'Indore',
    state: 'Madhya Pradesh',
    area: 'South Tukoganj',
    location: {
      type: 'Point',
      coordinates: [75.8839, 22.7196],
      address: 'South Tukoganj, Indore, Madhya Pradesh',
      formattedAddress: 'South Tukoganj, Indore, Madhya Pradesh',
      area: 'South Tukoganj',
      city: 'Indore',
      state: 'Madhya Pradesh'
    },
    items: [
      {
        name: 'Grilled Chicken Protein Bowl',
        description: 'Tender grilled chicken breast served with brown rice, steamed veggies & olive oil dressing.',
        price: 180,
        foodType: 'Non-Veg',
        categoryName: 'High Protein',
        preparationTime: '15-20 min',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Paneer Power Salad',
        description: 'Fresh cottage cheese cubes tossed with bell peppers, cucumber & flax seeds.',
        price: 160,
        foodType: 'Veg',
        categoryName: 'High Protein',
        preparationTime: '10-12 min',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Egg & Avocado Wrap',
        description: 'Whole wheat wrap filled with boiled egg whites, creamy avocado & herb dressing.',
        price: 140,
        foodType: 'Non-Veg',
        categoryName: 'Low Carb',
        preparationTime: '12 min',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      }
    ]
  },
  {
    restaurantName: 'NutriBowl Healthy Express',
    ownerName: 'Ananya Verma',
    ownerEmail: 'nutribowl@dietwala.com',
    ownerPhone: '9876543211',
    primaryContactNumber: '9876543211',
    pureVegRestaurant: true,
    status: 'approved',
    isAvailable: true,
    rating: 4.7,
    ratingCount: 98,
    cuisines: ['Weight Loss', 'Low Carb', 'Keto'],
    minOrderAmount: 130,
    estimatedDeliveryTime: '20-25 min',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    addressLine1: 'Vijay Nagar',
    city: 'Indore',
    state: 'Madhya Pradesh',
    area: 'Vijay Nagar',
    location: {
      type: 'Point',
      coordinates: [75.892, 22.7533],
      address: 'Vijay Nagar, Indore, Madhya Pradesh',
      formattedAddress: 'Vijay Nagar, Indore, Madhya Pradesh',
      area: 'Vijay Nagar',
      city: 'Indore',
      state: 'Madhya Pradesh'
    },
    items: [
      {
        name: 'Detox Green Smoothie Bowl',
        description: 'Spinach, green apple, banana & chia seeds topped with toasted almonds.',
        price: 130,
        foodType: 'Veg',
        categoryName: 'Weight Loss',
        preparationTime: '10 min',
        image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Roasted Chickpea & Quinoa Bowl',
        description: 'Organic quinoa, crispy chickpeas, cherry tomatoes & lemon mint dressing.',
        price: 150,
        foodType: 'Veg',
        categoryName: 'Weight Loss',
        preparationTime: '15 min',
        image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Tofu & Broccoli Keto Bowl',
        description: 'Sautéed tofu cubes and fresh broccoli in low-sodium soy sesame sauce.',
        price: 170,
        foodType: 'Veg',
        categoryName: 'Low Carb',
        preparationTime: '15 min',
        image: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      }
    ]
  },
  {
    restaurantName: 'MuscleFuel Kitchen',
    ownerName: 'Vikram Singh',
    ownerEmail: 'musclefuel@dietwala.com',
    ownerPhone: '9876543212',
    primaryContactNumber: '9876543212',
    pureVegRestaurant: false,
    status: 'approved',
    isAvailable: true,
    rating: 4.9,
    ratingCount: 210,
    cuisines: ['Muscle Gain', 'High Protein'],
    minOrderAmount: 150,
    estimatedDeliveryTime: '25-35 min',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    addressLine1: 'Palasia',
    city: 'Indore',
    state: 'Madhya Pradesh',
    area: 'Palasia',
    location: {
      type: 'Point',
      coordinates: [75.8864, 22.7244],
      address: 'Palasia, Indore, Madhya Pradesh',
      formattedAddress: 'Palasia, Indore, Madhya Pradesh',
      area: 'Palasia',
      city: 'Indore',
      state: 'Madhya Pradesh'
    },
    items: [
      {
        name: 'High Protein Chicken Meal Bowl',
        description: '300g Lean chicken breast with sweet potato mash & blanched asparagus.',
        price: 220,
        foodType: 'Non-Veg',
        categoryName: 'Muscle Gain',
        preparationTime: '20 min',
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Soya Chunks Protein Power Bowl',
        description: 'Soya nuggets cooked in aromatic mild spices served with quinoa.',
        price: 140,
        foodType: 'Veg',
        categoryName: 'Muscle Gain',
        preparationTime: '15 min',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Protein Oats & Banana Bowl',
        description: 'Rolled oats cooked in almond milk, whey protein, banana slices & walnuts.',
        price: 120,
        foodType: 'Veg',
        categoryName: 'Muscle Gain',
        preparationTime: '10 min',
        image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      }
    ]
  },
  {
    restaurantName: 'GreenLife Salad Bar',
    ownerName: 'Pooja Gupta',
    ownerEmail: 'greenlife@dietwala.com',
    ownerPhone: '9876543213',
    primaryContactNumber: '9876543213',
    pureVegRestaurant: true,
    status: 'approved',
    isAvailable: true,
    rating: 4.6,
    ratingCount: 75,
    cuisines: ['Vegan', 'Weight Loss', 'Organic'],
    minOrderAmount: 110,
    estimatedDeliveryTime: '15-20 min',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    addressLine1: 'Bhawarkua',
    city: 'Indore',
    state: 'Madhya Pradesh',
    area: 'Bhawarkua',
    location: {
      type: 'Point',
      coordinates: [75.8675, 22.692],
      address: 'Bhawarkua, Indore, Madhya Pradesh',
      formattedAddress: 'Bhawarkua, Indore, Madhya Pradesh',
      area: 'Bhawarkua',
      city: 'Indore',
      state: 'Madhya Pradesh'
    },
    items: [
      {
        name: 'Mediterranean Avocado Salad',
        description: 'Sliced Hass avocado, kalamata olives, cucumbers, and extra virgin olive oil.',
        price: 160,
        foodType: 'Veg',
        categoryName: 'Vegan',
        preparationTime: '12 min',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      },
      {
        name: 'Sprouted Moong & Pomegranate Salad',
        description: 'Freshly sprouted green moong, pomegranate seeds, coriander & tangy chat masala.',
        price: 110,
        foodType: 'Veg',
        categoryName: 'Weight Loss',
        preparationTime: '8 min',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
        approvalStatus: 'approved',
        isAvailable: true
      }
    ]
  }
];

async function seedData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    for (const restData of sampleRestaurants) {
      const { items, ...restInfo } = restData;

      // Upsert restaurant by name
      let restaurant = await FoodRestaurant.findOne({ restaurantName: restInfo.restaurantName });
      if (!restaurant) {
        restaurant = await FoodRestaurant.create({
          ...restInfo,
          restaurantNameNormalized: restInfo.restaurantName.toLowerCase().replace(/\s+/g, '-'),
          ownerPhoneDigits: restInfo.ownerPhone,
          ownerPhoneLast10: restInfo.ownerPhone.slice(-10)
        });
        console.log(`Created Restaurant: ${restaurant.restaurantName} (ID: ${restaurant._id})`);
      } else {
        Object.assign(restaurant, restInfo);
        await restaurant.save();
        console.log(`Updated Restaurant: ${restaurant.restaurantName} (ID: ${restaurant._id})`);
      }

      // Add Food Items for this restaurant
      for (const itemData of items) {
        const existingItem = await FoodItem.findOne({
          restaurantId: restaurant._id,
          name: itemData.name
        });

        if (!existingItem) {
          const newItem = await FoodItem.create({
            ...itemData,
            restaurantId: restaurant._id,
            requestedAt: new Date(),
            approvedAt: new Date()
          });
          console.log(`   + Added Food Item: "${newItem.name}" (Price: ₹${newItem.price})`);
        } else {
          Object.assign(existingItem, itemData);
          await existingItem.save();
          console.log(`   ~ Updated Food Item: "${existingItem.name}"`);
        }
      }
    }

    console.log('\n✅ Successfully seeded 4 Healthy Diet Restaurants & their Food Items!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedData();
