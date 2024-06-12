const productCollection = require('../../Schema/productModel')
const categoryCollection= require('../../Schema/categoryModel')
const { query } = require('express')

const showShopPage = async (req, res) => {
  const category = req.query.category || ""
    try
    {
        const categoryData= await productCollection.aggregate([
          {$match:{product_status:1}},
            {
              $group: {
                _id: "$category_id",
                category_name: { $first: "$category_name" }, 
                count: { $sum: 1 }  
              }
            },
            {
              $project: {
                _id: 0,
                category_id: "$_id",
                category_name: 1,
                count: 1
              }
            }
          ])
          let query;
          if(category){
            query= {product_status:1,
              category_id:category
            }
          }
          else{
            query= {product_status:1
            }
          }

          const productData= await productCollection.find(query).sort({timestamp:-1})
          res.render('./user/shop',{categoryData,productData,category})
    } 
    catch(err)
    {
        console.log(err)
    }
    
}
const showWIthFilter = async (req, res) => {
  const category = req.query.category || "";
  const data = {
    minAmount: req.body.minPrice,
    maxAmount: req.body.maxPrice
  };
  
  let query = {
    product_status: { $ne: -1 },
    // Combine price conditions using $and operator
    $and: [
      { product_price: { $gte: data.minAmount } },
      { product_price: { $lte: data.maxAmount } }
    ]
  };

  if (category) {
    query.category_id = category;
  }

  try {
    console.log(query);
    const categoryData = await productCollection.aggregate([
      {$match:{product_status:1}},
      {
        $group: {
          _id: "$category_id",
          category_name: { $first: "$category_name" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          category_id: "$_id",
          category_name: 1,
          count: 1
        }
      }
    ]);

    const productData = await productCollection.find(query).sort({ timestamp: -1 });
    res.render('./user/shop', { categoryData, productData, category });
  } catch (err) {
    console.log(err);
  }
};



module.exports ={
    showShopPage,
    showWIthFilter
}