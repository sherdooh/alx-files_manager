import sha1 from 'sha1';
import { ObjectID } from 'mongodb';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;

    try {
      if (!email) {
        throw new Error('Missing required field: email');
      }

      if (!password) {
        throw new Error('Missing required field: password');
      }

      const users = dbClient.db.collection('users');
      const user = await users.findOne({ email });

      if (user) {
        throw new Error('User already exists');
      }

      const hashedPassword = sha1(password);
      const result = await users.insertOne({
        email,
        password: hashedPassword,
      });

      const userId = result.insertedId;
      response.status(201).json({ id: userId, email });
      userQueue.add({ userId });
    } catch (error) {
      console.error(error);
      response.status(400).json({ error: error.message });
    }
  }

  static async getMe(request, response) {
    try {
      const token = request.header('X-Token');
      const key = `auth_${token}`;

      const userId = await redisClient.get(key);

      if (!userId) {
        throw new Error('Unauthorized');
      }

      const users = dbClient.db.collection('users');
      const idObject = new ObjectID(userId);
      const user = await users.findOne({ _id: idObject });

      if (!user) {
        throw new Error('Unauthorized');
      }

      response.status(200).json({ id: userId, email: user.email });
    } catch (error) {
      console.error(error);
      response.status(401).json({ error: error.message });
    }
  }
}

export default UsersController;
