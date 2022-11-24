const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const port = process.send.PORT || 5000;

// initialize express
const app = express();

// initialize dotenv
require('dotenv').config();

// middleware
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
	res.send('Resale market is running...');
});

const uri = process.env.DB_URL;
const client = new MongoClient(uri);

async function crudOperation() {
	try {
		const categoriesCollection = client.db("resale-market").collection('categories');
		const productsCollection = client.db('resale-market').collection('products');

		// sends all categories
		app.get('/categories', async (req, res) => {
			// project returns specific keys only
			const cursor = categoriesCollection.find({}).project({ name: 1, img: 1 });
			const categories = await cursor.toArray();
			res.send(categories);
		})

		// sends items of specific category
		app.get('/category/:id', async (req, res) => {
			const query = { categoryId: req.params.id };
			const cursor = productsCollection.find(query);
			const categories = await cursor.toArray();
			res.send(categories);
		});
	}
	catch (err) {
		console.log(err);
	}
}

crudOperation();

app.listen(port, () => console.log('Listening to port', port));