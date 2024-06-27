const wishlistCollection = require('../../Schema/wishlistModel')
const productCollection = require('../../Schema/productModel');
const { ObjectId } = require('mongodb');
const cartCollection = require('../../Schema/cartModel');

// ----------------------- adding and remove  wishlist items ----------------- 
const addWishlist = async (req, res) => {
    const response = {};
  
    if (!req.session.user) {
      response.success = false;  
      response.redirect = '/login';
      return res.status(200).json(response);  // Ensure JSON response
    }
  
    const data = {
      customer_id: req.session.user,
      product_id: req.body.productId,
    };
  
    try {
      const checkWishList = await wishlistCollection.findOne(data);
      const checkCartList = await cartCollection.findOne(data)
      if(checkCartList == null){

      
      if (checkWishList == null) {
        
        await wishlistCollection.insertMany(data);
        response.success = true;
        response.action = 'added';
      } else {
        await wishlistCollection.findOneAndDelete({ _id: checkWishList._id });
        response.success = true;
        response.action = 'deleted';
      }
      res.status(200).json(response);  // Ensure JSON response
    }
    else
    {
        response.success = true;
        response.action = 'cartIn';
        res.status(200).json(response);
    }
      
    } catch (err) {
      console.log(err);
      res.status(400).json({ success: false, message: err.message });  // Ensure JSON response
    }
  };

  
//   ------------------------- showing wish list ---------------------------- 


const showWishlist = async (req,res)=>{

    const userId = req.session.user;
    try{
        await checkWishlistStatus(userId)
        const wishlistData = await wishlistCollection.aggregate([
            { $match: { customer_id: new ObjectId(userId) } },
            {
              $lookup: {
                from: "products", // Name of the collection to join
                localField: "product_id", // Field from the input documents
                foreignField: "_id", // Field from the documents of the "from" collection
                as: "product_data", // Output array field
              },
            },
          ]);

        res.render('./user/wishlist',{  wishlistData})
    }
    catch(err){
        console.log(err)
    }
}

// ---------------------------- Remove items from  wishlist -------------------- 

const removeWishlistItem = async (req,res)=>{
    const id = req.params.id
    const responces={}
    try{
        const removeItem = await wishlistCollection.findOneAndDelete({_id:id})
        responces={
            message:'success'
        }
        res.status('200').json(responces)
    } catch(err){ 
                console.log(err)
               res.status('400').json(responces)    }
}

// --------------------------------------- add item from  wishlist to cart ------------------- 

const wishlistToCart = async (req,res)=>{
    const productId = req.params.id;
    const userId = req.session.user;
    let responce = {}
    try{
        const findProduct = await productCollection.findOne({_id : new ObjectId(productId),product_status: 1, product_status:{$gt:0} })
        if(findProduct)
            {
                const data = {
                    customer_id: userId,
                    product_id: productId,
                    quantity: 1,
                  };
                const addtoCart = await cartCollection.insertMany(data);
                if(addtoCart)
                {
                    const removeWishlist = await wishlistCollection.findOneAndDelete({product_id : productId , customer_id: userId})
                    responce ={ 
                        status: success,
                        message : " product added to  cart "
                    }
                    res.json(responce)
                }
                else
            {
                responce={
                    status:error,
                    message : 'Not able to add product'
                }
                res.json(responce)
                
            }
            }
            else
            {
                responce={
                    status:error,
                    message : 'out of stock'
                }
                res.json(responce)
                
            }



    }catch(err){
        console.log(err)
    }
    

}

async function checkWishlistStatus(userId)
{
    const  wishlistData = await wishlistCollection.find({customer_id:userId})
    if(wishlistData)
        {
            wishlistData.forEach(async (data) => {
                const productData = await productCollection.findOne({_id: data.product_id},{product_stock:1,product_status:1})
                if(productData && productData.product_stock>0 && productData.product_status==1 && data.wishlist_status!==1)
                    {
                        await wishlistCollection.findOneAndUpdate({_id:data._id},{$set:{wishlist_status : 1}})
                    }
                    else if(data.wishlist_status!==0)
                    {
                        await wishlistCollection.findOneAndUpdate({_id:data._id},{$set:{wishlist_status : 0 }})

                    }
            });
        }
}

module.exports ={
    addWishlist,
    showWishlist,
    removeWishlistItem,
    wishlistToCart
}