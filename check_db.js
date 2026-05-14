const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Connected to MongoDB');
    
    const FillSchema = require('./Models/FillCheckListModel');
    const DriverSchema = require('./Models/DriverModel');
    const UserSchema = require('./Models/UserModel');
    
    const fills = await FillSchema.find().sort({ createdAt: -1 }).limit(5);
    
    console.log('Recent 5 fills:');
    for (const fill of fills) {
      const driver = await DriverSchema.findById(fill.driverId);
      const user = await UserSchema.findById(fill.driverId);
      console.log(`Fill ID: ${fill._id}`);
      console.log(`Driver ID: ${fill.driverId}`);
      console.log(`In Driver Collection: ${driver ? driver.username : 'NOT FOUND'}`);
      console.log(`In User Collection: ${user ? user.username : 'NOT FOUND'}`);
      console.log('---');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

dbConnect();
