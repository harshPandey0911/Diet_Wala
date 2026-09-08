import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Curated high quality food images mapping for categories
const CATEGORY_IMAGE_MAP = {
  "pizza": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
  "pizzas": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
  "burger": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  "burgers": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
  "rolls": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80",
  "thali": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80",
  "biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80",
  "noodles": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&q=80",
  "chinese": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&q=80",
  "chinese non veg": "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&q=80",
  "south indian": "https://images.unsplash.com/photo-163038324989f-4b14694c2517?w=400&q=80",
  "vegan": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  "gourmet": "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&q=80",
  "indian snacks": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "chaat": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "soups": "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80",
  "soup non-veg": "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80",
  "mocktails / smoothies": "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&q=80",
  "raita / salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  "appetizers non veg": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80",
  "appetizers veg": "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&q=80",
  "shakes/crush": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80",
  "ice cream shakes": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80",
  "wraps": "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&q=80",
  "fish": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&q=80",
  "amritsari naan": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "oriental starters": "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&q=80",
  "sub": "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&q=80",
  "shaan - e - basmati": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&q=80",
  "non veg tandoori": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80",
  "indian course veg": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=80",
  "indian course [non veg]": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&q=80",
  "juice [packed]": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400&q=80",
  "beverages": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80",
  "drinks & juice": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&q=80",
  "rice": "https://images.unsplash.com/photo-1516684732162-798a0062be99?w=400&q=80",
  "nibbles hurry up": "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=400&q=80",
  "sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80",
  "non veg combo": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "veg combo": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80",
  "chaaps": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80",
  "breakfast": "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=80",
  "veg tandoori items": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&q=80",
  "sizzlers": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "momos": "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400&q=80",
  "chef's special": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "continental": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&q=80",
  "ice cream": "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&q=80",
  "sweets / desserts": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80",
  "festive sweets": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80",
  "bread station": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
  "pastas": "https://images.unsplash.com/photo-1621996346565-e3d5d6281274?w=400&q=80",
  "garlic bread": "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&q=80",
  "taccos": "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=80",
  "maggie": "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&q=80",
  "chicken": "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&q=80",
  "papad": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "bakery": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80",
  "gym freak": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80",
  "lunch": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&q=80",
  "dinner": "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  "tikki junction": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "buy 1 get 1 free": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80",
  "fruit cream": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80",
  "parantha": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "roti": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "snacks": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80",
  "tea & coffee": "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400&q=80",
  "waffles": "https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=400&q=80",
  "cake": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80",
  "diet food": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80"
};

const DEFAULT_FOOD_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";

async function main() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not set in .env");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;

    // 1. Update Categories in food_categories
    console.log("\n1. Updating food_categories with Cloudinary/CDN image URLs...");
    const categoriesCol = db.collection('food_categories');
    const categories = await categoriesCol.find({}).toArray();
    let updatedCatCount = 0;

    for (const cat of categories) {
      const lowerName = String(cat.name || "").trim().toLowerCase();
      let newImage = CATEGORY_IMAGE_MAP[lowerName];
      if (!newImage) {
        // Find partial match
        const matchedKey = Object.keys(CATEGORY_IMAGE_MAP).find(k => lowerName.includes(k) || k.includes(lowerName));
        newImage = matchedKey ? CATEGORY_IMAGE_MAP[matchedKey] : DEFAULT_FOOD_IMAGE;
      }

      await categoriesCol.updateOne(
        { _id: cat._id },
        { $set: { image: newImage, updatedAt: new Date() } }
      );
      updatedCatCount++;
    }
    console.log(`Updated ${updatedCatCount} categories successfully.`);

    // 2. Populate food_dining_banners
    console.log("\n2. Populating food_dining_banners collection...");
    const diningBannersCol = db.collection('food_dining_banners');
    await diningBannersCol.deleteMany({}); // clear old empty/broken items

    const sampleDiningBanners = [
      {
        imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
        title: "Luxury & Casual Dining",
        tagline: "Book your table and get up to 30% OFF",
        ctaText: "BOOK NOW",
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200&q=80",
        title: "Gourmet Dining Experience",
        tagline: "Discover top-rated fine dining restaurants near you",
        ctaText: "EXPLORE",
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
        title: "Family & Rooftop Dining",
        tagline: "Reserve tables with exclusive member benefits",
        ctaText: "RESERVE TABLE",
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await diningBannersCol.insertMany(sampleDiningBanners);
    console.log(`Inserted ${sampleDiningBanners.length} dining banners into food_dining_banners.`);

    // 3. Fix broken restaurant images & food item images (e.g. Pizza King)
    console.log("\n3. Fixing broken restaurant & food item images in DB...");
    const restaurantsCol = db.collection('food_restaurants');
    const itemsCol = db.collection('food_items');

    const restaurants = await restaurantsCol.find({}).toArray();
    let updatedRestCount = 0;

    for (const rest of restaurants) {
      let isChanged = false;
      const updates = {};

      const profileImg = String(rest.profileImage || "").trim();
      if (!profileImg || profileImg.endsWith('.png') || profileImg.endsWith('.jpg') || !profileImg.startsWith('http')) {
        updates.profileImage = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80";
        isChanged = true;
      }

      if (!Array.isArray(rest.coverImages) || rest.coverImages.length === 0 || !rest.coverImages[0]?.startsWith('http')) {
        updates.coverImages = ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"];
        isChanged = true;
      }

      if (isChanged) {
        await restaurantsCol.updateOne({ _id: rest._id }, { $set: updates });
        updatedRestCount++;
      }
    }
    console.log(`Updated ${updatedRestCount} restaurants with clean image URLs.`);

    const items = await itemsCol.find({}).toArray();
    let updatedItemCount = 0;

    for (const item of items) {
      const itemImg = String(item.image || "").trim();
      if (!itemImg || !itemImg.startsWith('http') || itemImg.includes('.png')) {
        const lowerItemName = String(item.name || "").toLowerCase();
        let foodImg = DEFAULT_FOOD_IMAGE;

        for (const [key, url] of Object.entries(CATEGORY_IMAGE_MAP)) {
          if (lowerItemName.includes(key)) {
            foodImg = url;
            break;
          }
        }

        await itemsCol.updateOne({ _id: item._id }, { $set: { image: foodImg } });
        updatedItemCount++;
      }
    }
    console.log(`Updated ${updatedItemCount} food items with clean image URLs.`);

    console.log("\n✅ All database image URLs and dining banners successfully updated!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error updating database:", err);
    process.exit(1);
  }
}

main();
