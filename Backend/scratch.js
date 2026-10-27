import mongoose from 'mongoose';

const uri = 'mongodb+srv://tuggo:tuggo@tuggo.y39vhkd.mongodb.net/Tuggo';
mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    const orderModel = mongoose.connection.collection('food_orders');
    // find orders that might have duplicate orderId or show the structure
    const orders = await orderModel.find({}).sort({createdAt: -1}).limit(5).toArray();
    console.log(JSON.stringify(orders.map(o => ({ _id: o._id, orderId: o.orderId, items: o.items?.length, pricing: o.pricing, user: o.userId })), null, 2));
    process.exit(0);
  });
