const { ObjectId } = require('mongodb')
const cartCollection = require('../../Schema/cartModel')
const productCollection = require('../../Schema/productModel')
const clinetCollection = require('../../Schema/clientModel')
const {addressValidation} = require('../../public/user/validation')
const orderCollection = require('../../Schema/orderModel')
let globalNotification ={}
const addToCart = async (req, res) => {
    const data = {
        customer_id: req.session.user,
        product_id: req.params.id,
        quantity: req.body.quantity
    };

    try {
        const stock = await productCollection.findOne({ _id: new ObjectId(data.product_id),product_status:1 }, { product_stock: 1 });

        if(stock.product_stock < data.quantity || data.quantity <= 0) {
            globalNotification = {
                status: 'error',
                message: data.quantity <= 0 ? "Please add a valid quantity" : `Maximum quantity that can be added is ${stock.product_stock}`
            };
            return res.redirect(`/view-product/${data.product_id}`);
        }

        const checkProduct = await productExist(data.product_id, data.customer_id);

        if (checkProduct) {
            const newQuantity = data.quantity + checkProduct.quantity;
            
                await cartCollection.findOneAndUpdate(
                    { _id: new ObjectId(checkProduct._id), product_id: new ObjectId(data.product_id) },
                    { $set: { quantity: data.quantity } },
                    { returnOriginal: false }
                );
            
        } else {
            data['cart_status'] = 1;
            await cartCollection.insertMany(data);
        }

        globalNotification = {
            status: 'success',
            message: "Product Added to Cart"
        };
        res.redirect(`/view-product/${data.product_id}`);
    } catch (err) {
        console.log(err);
        res.redirect(`/view-product/${data.product_id}`);
    }
};

// ------------------------- View Single Product -----------------------

const viewProduct = async (req, res) => {
    const id = req.params.id || "";
    const userId = req.session.user
    let notification ={}
    if(globalNotification.status)
        {
            notification= globalNotification;
            globalNotification={}
        }
    if (id !== "") {
      try {
        // ------------------- Checking the user is active and product already exitst ------------------
        const cartData = await productExist(id,userId)

        const productData = await productCollection.findOne({
          _id: new ObjectId(id),
        });
        const allProducts = await productCollection.find({category_id:productData.category_id, product_status:1 , _id:{$ne:new ObjectId(productData._id)}})
        res.render("./user/singleProduct", { productData,allProducts,notification , cartData});
      } catch (err) {
        console.log(err);
        res.redirect("/");
      }
    } else {
      res.redirect("/");
    }
  };

  const viewCart= async (req,res)=>{
      const userId= req.session.user;
      let productData=[];
      let notification={}
      if(globalNotification.status){
        notification=globalNotification;
        globalNotification={}
      }
      try{  
            let cartItems = await cartCollection.find({customer_id: new ObjectId(userId)})
            
            if(cartItems)
                {
                    await checkProductAvailability(cartItems)
                     productData = await cartCollection.aggregate([
                        { $match: { customer_id: new ObjectId(userId) } },
                        { 
                            $lookup: {
                                from: 'products',  // Name of the collection to join
                                localField: 'product_id',   // Field from the input documents
                                foreignField: '_id',        // Field from the documents of the "from" collection
                                as: 'product_data'          // Output array field
                            }
                        }
                    ]);
                    
                }
                
            res.render('./user/cart',{productData, notification})    

      }
      catch(err){
        console.log(err)
      }


  }

//   --------------------- Remove cart item -------------- 

const removeCartItem = async (req,res)=>{
    const cartId = req.params.id
    try{
        const removeItem = await cartCollection.findOneAndDelete({_id: new ObjectId(cartId)})
        if(removeItem)
            {
                globalNotification={
                    status:'success',
                    message:"Item Removed from Cart"
                }
                
            }
    }
    catch(err)
    {
        globalNotification={
            status:'error',
            message:"Something went wrong"
        }
        console.log(err)
    }
    res.redirect('/view-cart')

}

// ----------------------- load CeckOut Page -----------------------
const checkoutPage = async (req,res)=>{
    const user_id = req.session.user;
    let notification={}
    if(globalNotification.status)
        {
            notification = globalNotification;
            globalNotification={}
        }
    try{
        const userData= await clinetCollection.findOne({_id: new ObjectId(user_id),customer_status:1},{customer_name:1,customer_phone:1,customer_emailid:1,customer_address:1})
        let productData = await cartCollection.find({customer_id: new ObjectId(user_id)})
        await checkProductAvailability(productData);
        productData=await cartCollection.aggregate([
            { $match: { customer_id: new ObjectId(user_id), cart_status : 1} },
            { 
                $lookup: {
                    from: 'products',  
                    localField: 'product_id',   
                    foreignField: '_id',        
                    as: 'product_data'
                }
            }
        ]);
        if(productData.length!== 0)
            {
                
                res.render('./user/checkOut',{userData,productData,notification})
            }
            else
            {
                globalNotification={
                    status:'error',
                    message:'Cart is empty add something to Cart'
                }
                res.redirect('/view-cart')
            }
        
    }
    catch(err)
    {
        console.log(err);
        globalNotification={
            status:'error',
            message:'something went wrong.Try again'
        }
        res.redirect('/view-cart')
    }
    


}


const checkOut = async (req, res) => {
    const userId = req.session.user;
    const addressData = {
        building: req.body.building,
        street: req.body.street,
        city: req.body.city,
        country: req.body.country,
        pincode: req.body.pincode,
        phonenumber:Number(req.body.phonenumber)
    };
    const customerData = {
        customer_name: req.body.customer_name,
        customer_emailid: req.body.customer_emailid
    };
    const paymentMethod = req.body.pay_method;

    // Validate address
    let addressValid = addressValidation(addressData);

    if (addressValid.status) {
        try {
            let cartData = await cartCollection.find({ customer_id: new ObjectId(userId), cart_status: 1 });
            await checkProductAvailability(cartData);

            let productData = await cartCollection.aggregate([
                { $match: { customer_id: new ObjectId(userId), cart_status: 1 } },
                {
                    $lookup: {
                        from: 'products',  // Name of the collection to join
                        localField: 'product_id',   // Field from the input documents
                        foreignField: '_id',        // Field from the documents of the "from" collection
                        as: 'product_data'          // Output array field
                    }
                }
            ]);

            if (productData.length !== 0) {
                let totalSum = 0;
                let totalQuantity = 0;
                let orderData = {
                    customer_id: userId,
                    products: []
                };

                productData.forEach(async (product) => {
                    let productDetail = product.product_data[0]; // Accessing the first element of product_data array

                    // Safely accessing product_image[0]
                    let productImage = productDetail.product_image && productDetail.product_image.length > 0
                        ? productDetail.product_image[0]
                        : null; // or provide a default image URL if needed

                    let singleProduct = {
                        product_id: productDetail._id,
                        product_name: productDetail.product_name,
                        product_category: productDetail.category_name,
                        product_quantity: product.quantity,
                        product_price: productDetail.product_price,
                        product_image: productImage
                    };

                    totalSum += singleProduct.product_quantity * singleProduct.product_price;
                    totalQuantity += singleProduct.product_quantity;
                    orderData.products.push(singleProduct);

                    await productCollection.updateOne(
                        { _id: singleProduct.product_id },
                        { $inc: { product_stock: -singleProduct.product_quantity } }
                    );
                
                });

                orderData.totalPrice = totalSum;
                orderData.totalQuantity = totalQuantity;
                orderData.address = addressData;
                orderData.paymentMethod = paymentMethod;
                orderData.orderStatus = 'Pending';
                const addOrder = await orderCollection.insertMany(orderData)

                

            } else {
                globalNotification = {
                    status: 'error',
                    message: "Something went wrong"
                };
            }
        } catch (err) {
            globalNotification = {
                status: 'error',
                message: "Something went wrong"
            };
            console.log(err);
        }
    } else {
        globalNotification = {
            status: 'error',
            message: addressValid.message
        };
        return res.redirect('/checkout'); // Correct redirection on address validation failure
    }

    res.redirect('/view-cart');
};




  async function checkProductAvailability(cartItems) {
    const updatedCartItems = [];

    for (const element of cartItems) {
        let response = { status: true };

        try {
            const product = await productCollection.findOne({ _id: new ObjectId(element.product_id), product_status: 1 });

            if (!product) {
                await cartCollection.findOneAndUpdate({_id: new ObjectId(element._id)},{$set:{cart_status : 0}})
                response = {
                    status: false,
                    message: "Product Not Available"
                };
            } else if (product.product_stock <= 0) {
                await cartCollection.findOneAndUpdate({_id: new ObjectId(element._id)},{$set:{cart_status : 0}})
                response = {
                    status: false,
                    message: "Out Of Stock"
                };
            } else if (product.product_stock < element.quantity) {
                await cartCollection.findOneAndUpdate({_id: new ObjectId(element._id)},{$set:{cart_status : 0}})
                response = {
                    status: false,
                    message: `Product stock is limited. You can purchase a maximum of ${product.product_stock} quantity`
                };
            }
            else if(element.cart_status===0)
            {
                await cartCollection.findOneAndUpdate({_id: new ObjectId(element._id)},{$set:{cart_status : 1}})
            }
        } catch (err) {
            console.error(err);
            response = {
                status: false,
                message: "Error checking product availability"
            };
        }

        const plainElement = element.toObject ? element.toObject() : element;  // Convert to plain object if it's a Mongoose document
        plainElement.availability = response.status;

        if (!response.status) {
            plainElement.message = response.message;
        }

        updatedCartItems.push(plainElement);
    }

    return updatedCartItems;
}

  async function productExist(productId,userId){
    let responce;
    
    if(!productId || !userId){
        responce = false;
    }
    else
    {
       
        try
        {
            const checkProduct = await cartCollection.findOne({customer_id : new ObjectId(userId),product_id: new ObjectId(productId)})
        
        if(checkProduct!==null)
            {
                responce = checkProduct;
            }
            else
            {
                responce = false;
            }
        }
        catch(err)
        {
            console.log(err)
        }
    }

    return responce;
  }





module.exports = {
    addToCart,
    viewProduct,
    viewCart,
    removeCartItem,
    checkoutPage,
    checkOut
}




















 



