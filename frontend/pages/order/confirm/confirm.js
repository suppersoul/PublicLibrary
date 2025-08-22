// pages/order/confirm/confirm.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    orderItems: [],
    selectedAddress: null,
    selectedCoupon: null,
    availableCoupons: [],
    deliveryFee: 0,
    totalPrice: 0,
    discountAmount: 0,
    finalAmount: 0,
    remark: '',
    showCouponModal: false,
    loading: false,
    canSubmit: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取传入的订单数据
    if (options.data) {
      try {
        const orderItems = JSON.parse(decodeURIComponent(options.data))
        this.setData({ orderItems })
        this.calculatePrice()
      } catch (error) {
        console.error('解析订单数据失败:', error)
        wx.showToast({
          title: '订单数据错误',
          icon: 'error'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }
    }

    // 检查来源
    if (options.from === 'cart') {
      this.setData({ fromCart: true })
    }

    this.loadDefaultAddress()
    this.loadAvailableCoupons()
  },

  /**
   * 加载默认地址
   */
  loadDefaultAddress: function() {
    app.request('/api/addresses').then(res => {
      const addresses = res.data || []
      const defaultAddress = addresses.find(addr => addr.is_default)
      
      if (defaultAddress) {
        this.setData({ selectedAddress: defaultAddress })
        this.checkCanSubmit()
      }
    }).catch(error => {
      console.error('加载地址失败:', error)
    })
  },

  /**
   * 加载可用优惠券
   */
  loadAvailableCoupons: function() {
    app.request('/api/coupons').then(res => {
      const coupons = res.data || []
      // 过滤出可用的优惠券
      const availableCoupons = coupons.filter(coupon => {
        return coupon.status === 'unused' && 
               coupon.start_time <= new Date().toISOString() && 
               coupon.end_time >= new Date().toISOString() &&
               coupon.min_amount <= this.data.totalPrice
      })
      
      this.setData({ availableCoupons })
    }).catch(error => {
      console.error('加载优惠券失败:', error)
    })
  },

  /**
   * 计算价格
   */
  calculatePrice: function() {
    const { orderItems, deliveryFee, discountAmount } = this.data
    
    let totalPrice = 0
    orderItems.forEach(item => {
      totalPrice += parseFloat(item.price) * item.quantity
    })
    
    const finalAmount = Math.max(0, totalPrice + deliveryFee - discountAmount)
    
    this.setData({
      totalPrice: totalPrice.toFixed(2),
      finalAmount: finalAmount.toFixed(2)
    })
    
    this.checkCanSubmit()
  },

  /**
   * 检查是否可以提交订单
   */
  checkCanSubmit: function() {
    const { selectedAddress, orderItems } = this.data
    const canSubmit = selectedAddress && orderItems.length > 0
    
    this.setData({ canSubmit })
  },

  /**
   * 选择地址
   */
  selectAddress: function() {
    wx.navigateTo({
      url: '/pages/address/list/list?from=select'
    })
  },

  /**
   * 地址选择回调
   */
  onAddressSelected: function(address) {
    this.setData({ selectedAddress: address })
    this.checkCanSubmit()
  },

  /**
   * 选择优惠券
   */
  selectCoupon: function() {
    if (this.data.availableCoupons.length === 0) {
      wx.showToast({
        title: '暂无可用优惠券',
        icon: 'none'
      })
      return
    }
    
    this.setData({ showCouponModal: true })
  },

  /**
   * 隐藏优惠券弹窗
   */
  hideCouponModal: function() {
    this.setData({ showCouponModal: false })
  },

  /**
   * 选择优惠券
   */
  selectCouponItem: function(e) {
    const coupon = e.currentTarget.dataset.coupon
    
    if (!coupon.canUse) {
      return
    }
    
    this.setData({
      selectedCoupon: coupon,
      discountAmount: parseFloat(coupon.amount),
      showCouponModal: false
    })
    
    this.calculatePrice()
  },

  /**
   * 不使用优惠券
   */
  noCoupon: function() {
    this.setData({
      selectedCoupon: null,
      discountAmount: 0,
      showCouponModal: false
    })
    
    this.calculatePrice()
  },

  /**
   * 备注输入
   */
  onRemarkInput: function(e) {
    this.setData({
      remark: e.detail.value
    })
  },

  /**
   * 提交订单
   */
  submitOrder: function() {
    const { 
      orderItems, 
      selectedAddress, 
      selectedCoupon, 
      deliveryFee, 
      remark 
    } = this.data
    
    if (!selectedAddress) {
      wx.showToast({
        title: '请选择收货地址',
        icon: 'error'
      })
      return
    }
    
    if (orderItems.length === 0) {
      wx.showToast({
        title: '订单商品不能为空',
        icon: 'error'
      })
      return
    }
    
    this.setData({ loading: true })
    
    const orderData = {
      items: orderItems,
      address_id: selectedAddress.id,
      delivery_fee: deliveryFee,
      coupon_id: selectedCoupon?.id,
      remark: remark.trim()
    }
    
    app.request('/api/orders', orderData, 'POST').then(res => {
      wx.showToast({
        title: '订单创建成功',
        icon: 'success'
      })
      
      // 跳转到支付页面
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/order/payment/payment?order_id=${res.data.order_id}&amount=${res.data.final_amount}`
        })
      }, 1500)
      
    }).catch(error => {
      wx.showToast({
        title: error.message || '订单创建失败',
        icon: 'error'
      })
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '确认订单',
      path: '/pages/order/confirm/confirm'
    }
  }
})