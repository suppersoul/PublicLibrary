// pages/order/payment/payment.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    orderId: null,
    orderNo: '',
    amount: '0.00',
    selectedMethod: 'wechat',
    userBalance: '0.00',
    showConfirmModal: false,
    showResultModal: false,
    paymentSuccess: false,
    resultMessage: '',
    loading: false,
    canPay: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.order_id && options.amount) {
      this.setData({
        orderId: options.order_id,
        amount: options.amount
      })
      
      this.loadOrderInfo()
      this.loadUserBalance()
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  /**
   * 加载订单信息
   */
  loadOrderInfo: function() {
    const { orderId } = this.data
    
    app.request(`/api/orders/${orderId}`).then(res => {
      const order = res.data
      this.setData({
        orderNo: order.order_no
      })
    }).catch(error => {
      console.error('加载订单信息失败:', error)
      wx.showToast({
        title: '加载订单失败',
        icon: 'error'
      })
    })
  },

  /**
   * 加载用户余额
   */
  loadUserBalance: function() {
    app.request('/api/users/balance').then(res => {
      this.setData({
        userBalance: res.data.balance || '0.00'
      })
    }).catch(error => {
      console.error('加载用户余额失败:', error)
    })
  },

  /**
   * 选择支付方式
   */
  selectPaymentMethod: function(e) {
    const method = e.currentTarget.dataset.method
    
    // 检查余额是否足够
    if (method === 'balance') {
      const balance = parseFloat(this.data.userBalance)
      const amount = parseFloat(this.data.amount)
      
      if (balance < amount) {
        wx.showToast({
          title: '余额不足',
          icon: 'error'
        })
        return
      }
    }
    
    this.setData({
      selectedMethod: method
    })
  },

  /**
   * 确认支付
   */
  confirmPayment: function() {
    const { selectedMethod, amount, userBalance } = this.data
    
    // 检查余额
    if (selectedMethod === 'balance') {
      const balance = parseFloat(userBalance)
      const payAmount = parseFloat(amount)
      
      if (balance < payAmount) {
        wx.showToast({
          title: '余额不足',
          icon: 'error'
        })
        return
      }
    }
    
    this.setData({
      showConfirmModal: true
    })
  },

  /**
   * 隐藏确认弹窗
   */
  hideConfirmModal: function() {
    this.setData({
      showConfirmModal: false
    })
  },

  /**
   * 执行支付
   */
  doPayment: function() {
    const { selectedMethod, orderId, amount } = this.data
    
    this.setData({ 
      loading: true,
      showConfirmModal: false
    })
    
    // 根据支付方式调用不同的支付接口
    if (selectedMethod === 'wechat') {
      this.wechatPay(orderId, amount)
    } else if (selectedMethod === 'balance') {
      this.balancePay(orderId, amount)
    } else if (selectedMethod === 'alipay') {
      this.alipayPay(orderId, amount)
    }
  },

  /**
   * 微信支付
   */
  wechatPay: function(orderId, amount) {
    // 调用后端创建支付订单
    app.request('/api/payment/create', {
      order_id: orderId,
      amount: amount,
      method: 'wechat'
    }, 'POST').then(res => {
      const paymentData = res.data
      
      // 调用微信支付
      wx.requestPayment({
        timeStamp: paymentData.timeStamp,
        nonceStr: paymentData.nonceStr,
        package: paymentData.package,
        signType: paymentData.signType,
        paySign: paymentData.paySign,
        success: (res) => {
          this.handlePaymentSuccess()
        },
        fail: (err) => {
          console.error('微信支付失败:', err)
          this.handlePaymentFail('支付失败，请重试')
        }
      })
    }).catch(error => {
      console.error('创建支付订单失败:', error)
      this.handlePaymentFail(error.message || '创建支付订单失败')
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  /**
   * 余额支付
   */
  balancePay: function(orderId, amount) {
    app.request('/api/payment/balance', {
      order_id: orderId,
      amount: amount
    }, 'POST').then(res => {
      this.handlePaymentSuccess()
    }).catch(error => {
      console.error('余额支付失败:', error)
      this.handlePaymentFail(error.message || '余额支付失败')
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  /**
   * 支付宝支付
   */
  alipayPay: function(orderId, amount) {
    // 这里可以集成支付宝支付
    // 目前先模拟支付成功
    setTimeout(() => {
      this.handlePaymentSuccess()
    }, 2000)
  },

  /**
   * 处理支付成功
   */
  handlePaymentSuccess: function() {
    this.setData({
      paymentSuccess: true,
      resultMessage: '支付成功',
      showResultModal: true
    })
    
    // 更新订单状态
    this.updateOrderStatus()
  },

  /**
   * 处理支付失败
   */
  handlePaymentFail: function(message) {
    this.setData({
      paymentSuccess: false,
      resultMessage: message,
      showResultModal: true
    })
  },

  /**
   * 更新订单状态
   */
  updateOrderStatus: function() {
    const { orderId } = this.data
    
    // 这里可以调用后端接口更新订单状态
    // 或者通过支付回调自动更新
    console.log('订单状态已更新:', orderId)
  },

  /**
   * 隐藏结果弹窗
   */
  hideResultModal: function() {
    this.setData({
      showResultModal: false
    })
    
    if (this.data.paymentSuccess) {
      // 支付成功，跳转到订单详情
      wx.redirectTo({
        url: `/pages/order/detail/detail?id=${this.data.orderId}`
      })
    }
  },

  /**
   * 获取支付方式文本
   */
  getMethodText: function(method) {
    const methodMap = {
      'wechat': '微信支付',
      'balance': '余额支付',
      'alipay': '支付宝'
    }
    return methodMap[method] || '未知方式'
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '订单支付',
      path: '/pages/order/payment/payment'
    }
  }
})