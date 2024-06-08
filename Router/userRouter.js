const { Router } = require("express");
const router =Router()
const passport = require('passport');
const userContoller=require('../Controller/user/userController')
const shopController = require('../Controller/user/shopController')
const profileController = require('../Controller/user/profileController')
require('../Service/googleAuth')
const {userSessionCheck}= require('../Middleware/userMiddleware')
router.get('/',userContoller.indexPage)

router.get('/signup',userContoller.showSignUp)
router.post('/signup',userContoller.addUser)
router.get('/resendOTP',userContoller.resendOTP)
router.post('/otp-verification',userContoller.verifyOTP)
router.get('/otp-expired',userContoller.otpExpired)
router.get('/login',userContoller.loginLoad)
router.post('/login',userContoller.userLogin)
router.get('/logout',userContoller.logout)
router.get('/view-product/:id',userContoller.viewProduct)
router.get('/reset-password',userContoller.resetPassword)
router.post('/verifyEmail',userContoller.verifyEmail)
router.post('/otp-verification-password',userContoller.passwordOtpVerify)
router.post('/otp-verification-password',userContoller.passwordOtpVerify)
router.post('/updatePassword',userContoller.updatePassword)
router.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),userContoller.googleLogin);

// ------------ Shop ----------------- 
router.get('/shop',shopController.showShopPage)


// -------------- Profile page ----------------- 
router.get('/profile',userSessionCheck, profileController.showProfile)
router.post('/update-profile',userSessionCheck,profileController.updateProfile)
router.post('/add-address',userSessionCheck,profileController.addAddress)
router.get('/edit-address/:index',userSessionCheck,profileController.editAddress)
router.post('/update-address/:index',userSessionCheck,profileController.updateAddress)
router.get('/remove-address/:index',userSessionCheck,profileController.removeAddress)

module.exports = router     