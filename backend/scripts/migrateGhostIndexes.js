const mongoose = require('mongoose');
require('dotenv').config();

async function ensureSparseUniqueIndex(collection, field) {
  const name = `${field}_1`;
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === name);
  if (existing?.unique && existing?.sparse) return;
  if (existing) await collection.dropIndex(name);
  await collection.createIndex({ [field]: 1 }, { unique: true, sparse: true, name });
  console.log(`Migrated ${name} to a sparse unique index.`);
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const users = mongoose.connection.collection('users');
  await ensureSparseUniqueIndex(users, 'email');
  await ensureSparseUniqueIndex(users, 'phoneNumber');
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Ghost-member index migration failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
