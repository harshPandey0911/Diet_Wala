const fs = require('fs');
const data = JSON.parse(fs.readFileSync('out.json', 'utf8'));
const restaurants = data.data.allRawRestaurants || [];
restaurants.forEach(r => {
  console.log(`${r.name}: isActive=${r.isActive}, isAcceptingOrders=${r.isAcceptingOrders}`);
  console.log(`  openingTime=${r.openingTime}, closingTime=${r.closingTime}`);
  if (r.outletTimings && r.outletTimings.timings) {
     console.log(`  outletTimings:`, JSON.stringify(r.outletTimings.timings));
  }
  if (r.deliveryTimings) {
     console.log(`  deliveryTimings:`, JSON.stringify(r.deliveryTimings));
  }
});
