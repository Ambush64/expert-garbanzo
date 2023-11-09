const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origin: '*' }));

// const mongoURI = 'mongodb://127.0.0.1:27017/test-db';
// const client = new MongoClient(mongoURI);
mongoose.connect('mongodb://127.0.0.1:27017/test-db');

const jwtSecret = 'SWtJIr9-3UVNLQgqSLHi3T_xhSH2BpVp3wz8XfqCMU';

// Define MongoDB schema and model for users
const userSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  profilePicture: { type: String, required: true },
  department: { type: String, required: true },
  about: { type: String, required: true },
  hobbies: { type: [String], required: true },
  friends: { type: [mongoose.Schema.Types.ObjectId], ref: 'User' }
});

const User = mongoose.model('User', userSchema);

// Registration route
app.post('/register', async (req, res) => {
  const { name, email, password, profilePicture, department, about, hobbies } = req.body;

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Create a new user document with the hashed password
  const user = new User({ name, email, password: hashedPassword, profilePicture, department, about, hobbies });

  try {
    await user.save();
    res.status(201).send('Registration successful');
  } catch (error) {
    console.error(error.message);
    res.status(500).send(`Error registering user: ${error.message}`);
  }
});


// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      // Compare the provided password with the hashed password in the database
      const passwordMatch = bcrypt.compareSync(password, user.password);

      if (passwordMatch) {
        const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '1h' });
        res.json({ token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).send(`Error logging in user: ${error.message}`);
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  const Bearertoken = token.startsWith('Bearer ') ? token.slice(7) : token;

  if (!Bearertoken) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  jwt.verify(Bearertoken, jwtSecret, async (err, decoded) => {
    if (err) {
      console.error(err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.userId = decoded.userId;
    next();
  }
  );
};


// Route to get list of all registrations after login
app.get('/registrations', verifyToken, async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).send('Error fetching registrations');
  }
});


const getRegistrations = async (token) => {
  try {
    const response = await axios.get('http://localhost:8000/registrations', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('List of Registrations:', response.data);
  } catch (error) {
    console.error('Error fetching registrations:', error.message);
  }
};

// Replace <token> with the actual token obtained after login
const token = '<your_actual_token>';

// Call the function
getRegistrations(token);


// Friend Request Functionality
// Send Friend request to registered users
app.post('/send-friend-request/:friendId', verifyToken, async (req, res) => {
  const { friendId } = req.params;

  try {
    const user = await User.findById(req.userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    if (!user.friends.includes(friendId)) {
      user.friends.push(friendId);
      await user.save();

      res.status(200).json({ message: 'Friend request sent successfully' });
    } else {
      res.status(400).json({ error: 'Friend request already sent or user is already a friend' });
    }
  } catch (error) {
    res.status(500).send('Error sending friend request');
  }
});

// List of friend requests
app.get('/friend-requests', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', 'name');
    const friendRequests = await User.find({ _id: { $nin: [...user.friends, req.userId] } }, 'name');

    res.json(friendRequests);
  } catch (error) {
    res.status(500).send('Error fetching friend requests');
  }
});


// Accept friend request
app.post('/accept-friend-request/:friendId', verifyToken, async (req, res) => {
  const { friendId } = req.params;

  try {
    const user = await User.findById(req.userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ error: 'User is already a friend or friend request not found' });
    }

    user.friends.push(friendId);
    await user.save();

    res.status(200).json({ message: 'Friend request accepted successfully' });
  } catch (error) {
    res.status(500).send('Error accepting friend request');
  }
});

// Suggested friends
app.get('/suggested-friends', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('friends', 'name');
    const suggestedFriends = await User.find({ _id: { $nin: [...user.friends, req.userId] } }, 'name');

    res.json(suggestedFriends);
  } catch (error) {
    res.status(500).send('Error fetching suggested friends');
  }
});


// Start the server
app.listen(8000, () => {
  console.log('Server is running on port 8000');
});
