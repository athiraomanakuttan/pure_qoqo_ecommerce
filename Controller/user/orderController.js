const orderCollection = require('../../Schema/orderModel')
const productCollection = require('../../Schema/productModel')
const walletCollection = require('../../Schema/walletModel')
const PDFDocument = require('pdfkit')
const { ObjectId } = require("mongodb");
let globalNotification ={}


// ----------------------- view full order list ---------------------  
const viewOrders= async (req,res)=>{
    let notification={}
    const user_id = req.session.user
    if(globalNotification.status)
        {
         notification= globalNotification;
         globalNotification={}
        }
    try{
        // const updateOrder = await updateOrderStatus(user_id)
        
        const orderData = await orderCollection.find({customer_id:user_id}).sort({createdAt:-1})
        
        res.render('./user/order',{orderData,notification})
        
    }
    catch(err)
    {
        console.log(err); 
    }

}

// ------------------------- individual order view ------------- 
const viewOrderDetails = async (req,res)=>{
    let notification={}
     const customer_id = req.session.user;
    const order_id = req.params.id;
    try
    {
        const productData = await orderCollection.findOne({ _id : order_id,customer_id:customer_id })
        res.render('./user/singleOrderDetails',{ productData, notification })
    }
    catch(error)
    {
        globalNotification={
            status: "error",
            message: "Something went Wrong"
        }
        res.redirect('/orders')
    }
}

// -------------------- Cancel Entire Order ----------------- 

const cancelOrder = async (req, res) => {
    const orderId = req.params.id;
    const customer_id = req.session.user;

    try {
        const orderData = await orderCollection.findOne({ _id: orderId, customer_id: customer_id });
        if (orderData) {
            for (const product of orderData.products) {
                try {
                    await productCollection.findOneAndUpdate(
                        { _id: product.product_id },
                        { $inc: { product_stock: product.product_quantity } }
                    );
                    await orderCollection.findOneAndUpdate(
                        { _id: orderId, 'products.product_id': product.product_id },
                        { $set: { 'products.$.product_status': 'Cancelled' } }
                    );
                } catch (err) {
                    console.log(err);
                    globalNotification = {
                        status: 'error',
                        message: 'Something went wrong'
                    };
                    res.redirect('/orders');
                    return;
                }
            }

            await orderCollection.findOneAndUpdate({ _id: orderId }, { $set: { orderStatus: 'Cancelled' } });

            if (['razorpay', 'Wallet'].includes(orderData.paymentMethod)) {
                const wallet_balance = orderData.totalPrice;
                const transaction_details = {
                    wallet_amount: (orderData.totalPrice).toFixed(2),
                    order_id: orderData.order_id,
                    transactionType: 'Credited'
                };

                const checkWallet = await walletCollection.findOne({ customer_id: customer_id });
                if (checkWallet) {
                    await walletCollection.findOneAndUpdate(
                        { _id: checkWallet._id },
                        { 
                            $inc: { wallet_balance: wallet_balance },
                            $push: { transaction: transaction_details }
                        }
                    );
                } else {
                    await walletCollection.create({
                        customer_id: customer_id,
                        wallet_balance: wallet_balance,
                        transaction: [transaction_details]
                    });
                }
            }

            globalNotification = {
                status: 'success',
                message: 'Order Canceled Successfully'
            };
            res.redirect('/orders');
        }
    } catch (err) {
        console.log(err);
        globalNotification = {
            status: 'error',
            message: 'Something went wrong'
        };
        res.redirect('/orders');
    }
};

// ------------------------------ download invoice ------------------------- 

const downloadInvoice = async (req, res) => {
    const id = req.params.id;
    
    try {
        const order = await orderCollection.findOne({_id: new ObjectId(id)});
        if (!order) {
            return res.status(404).send('Order not found');
        }

        const doc = new PDFDocument();
        
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${order._id}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        // Header
        doc.fontSize(16)
           .text('Pure QOQO', 50, 50)
           .fontSize(10)
           .text('Your Company Address', 50, 70)
           .text('City, State ZIP', 50, 85)
        
        doc.fontSize(16)
           .text('Invoice', 250, 50, { align: 'center' });

        // Invoice details
        doc.fontSize(10)
           .text(`INVOICE NO #: ${order.order_id}`, 50, 120);

        // Billing Info
        doc.text('BILL TO:', 50, 180)
           .text(order.address.customer_name, 50, 195)
           .text(order.address.customer_emailid, 50, 210)
           .text(order.address.phonenumber, 50, 225)
           .text('SHIP TO:', 300, 180)
           .text(order.address.building +order.address.street , 300, 195)
           
           .text(order.address.city, 300, 210)
           .text(order.address.country + order.address.pincode, 300, 225)
           

           doc.moveTo(50, 260).lineTo(550, 260).stroke();
           doc.text('Product', 50, 270)
              .text('Category', 200, 270)
              .text('Qty', 300, 270)
              .text('Unit Price', 370, 270)
              .text('Amount', 470, 270);
           doc.moveTo(50, 285).lineTo(550, 285).stroke();
   
           // Table content
           let y = 300;
           order.products.forEach((item) => {
               doc.text(item.product_name, 50, y)
                  .text(item.product_category, 200, y)
                  .text(item.product_quantity.toString(), 300, y)
                  .text(`${item.product_price.toFixed(2)}`, 370, y)
                  .text(`${(item.product_quantity * item.product_price).toFixed(2)}`, 470, y);
               y += 20;
           });
           doc.moveTo(50, y).lineTo(550, y).stroke();
   

        // Totals
        const subtotal = order.products.reduce((sum, item) => sum + (item.product_quantity * item.product_price), 0);
        const discountMrp = 0; // Assuming no separate MRP discount field, set to 0 for now
        const couponDiscount = order.isCoupen && order.coupen_id ? subtotal - order.totalPrice : 0;

        y += 20;
        doc.text('Sub Total', 370, y)
           .text(`${subtotal.toFixed(2)}`, 470, y);
        y += 20;
        doc.text('Discount in MRP', 370, y).fillColor('red')
           .text(`-${discountMrp.toFixed(2)}`, 470, y);
        y += 20;
        doc.text('Coupon Discount', 370, y).fillColor('red')
           .text(`-${couponDiscount.toFixed(2)}`, 470, y);
        y += 20;
        doc.text('Shipping Charge', 370, y).fillColor("black")
           .text(subtotal<=1000 ? 25 : 0, 470, y);
        y += 20;
        doc.rect(370, y, 180, 25).fill('#800000');
        doc.fillColor('#FFFFFF')
           .text('Total', 380, y + 7)
           .text(`${order.totalPrice.toFixed(2)}`, 470, y + 7);

        // Payment Method
        doc.fillColor('#000000')
           .text(`Payment Method: ${order.paymentMethod}`, 50, y + 40);

        // Note
        doc.text('Note:', 50, y + 60)
           .text('Thank you for your business!', 50, y + 75);

        doc.end();

    } catch (error) {
        console.log(`Error from download invoice: ${error}`);
        res.status(500).send('Error generating invoice');
    }
};



// -------------------------------------- Other functions ------------------------- 

// ------------------- Recheck order STatus --------------- 

async function updateOrderStatus(customer_id)
{    
    const getOrderDetails = await orderCollection.find({ customer_id: customer_id })
    getOrderDetails.forEach(async (order)=>{
       const products = order.products;
       let status= true;
       const statusSet = new Set();
       for(let product of products)
        {
            if(statusSet.has(product))
                {
                    status = false;
                    break;
                }
                else
                {
                    statusSet.add(product)
                }
        }
        if(status && order.orderStatus!== order.products[0].product_status)
            {
                await orderCollection.findOneAndUpdate({ customer_id: customer_id,_id:order._id},{$set:{orderStatus:order.products[0].product_status}})
            }
    })

    
    
}
module.exports ={
viewOrders,
viewOrderDetails,
cancelOrder,
downloadInvoice
}