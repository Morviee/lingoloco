import { MongoClient } from 'mongodb';

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb+srv://morvi127533_db_user:TztrL4vxgUNvvtzU@lingoloco.ffoafuy.mongodb.net/?appName=LingoLoco";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected successfully to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
