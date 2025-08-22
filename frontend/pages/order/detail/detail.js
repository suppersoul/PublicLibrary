// pages/order/detail/detail.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    orderId: null,
    orderInfo: {},
    logistics: [],
    loading: true,
    showCancelModal: false,
    showDeleteModal: false,
    cancelReason: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.id) {
      this.setData({
        orderId: options.id
      })
      this.loadOrderDetail()
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
   * 加载订单详情
   */
  loadOrderDetail: function() {
    const { orderId } = this.data
    
    this.setData({ loading: true })
    
    app.request(`/api/orders/${orderId}`).then(res => {
      const orderInfo = res.data
      
      this.setData({
        orderInfo: orderInfo,
        loading: false
      })
      
      // 如果有物流信息，加载物流
      if (orderInfo.status === 'shipped' || orderInfo.status === 'delivered') {
        this.loadLogistics()
      }
    }).catch(error => {
      console.error('加载订单详情失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({ loading: false })
    })
  },

  /**
   * 加载物流信息
   */
  loadLogistics: function() {
    const { orderId } = this.data
    
    app.request(`/api/orders/${orderId}/logistics`).then(res => {
      this.setData({
        logistics: res.data || []
      })
    }).catch(error => {
      console.error('加载物流信息失败:', error)
    })
  },

  /**
   * 获取状态图标
   */
  getStatusIcon: function(status) {
    const iconMap = {
      'pending': '⏰',
      'paid': '📦',
      'shipped': '🚚',
      'delivered': '📋',
      'completed': '✅',
      'cancelled': '❌'
    }
    return iconMap[status] || '❓'
  },

  /**
   * 获取状态文本
   */
  getStatusText: function(status) {
    const statusMap = {
      'pending': '待付款',
      'paid': '待发货',
      'shipped': '待收货',
      'delivered': '待评价',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知状态'
  },

  /**
   * 获取状态描述
   */
  getStatusDesc: function(status) {
    const descMap = {
      'pending': '请尽快完成支付，超时订单将自动取消',
      'paid': '商家正在为您准备商品，请耐心等待',
      'shipped': '商品正在配送中，请注意查收',
      'delivered': '商品已送达，请及时确认收货并评价',
      'completed': '订单已完成，感谢您的购买',
      'cancelled': '订单已取消'
    }
    return descMap[status] || ''
  },

  /**
   * 获取支付方式文本
   */
  getPaymentMethodText: function(method) {
    const methodMap = {
      'wechat': '微信支付',
      'balance': '余额支付',
      'alipay': '支付宝'
    }
    return methodMap[method] || '未知方式'
  },

  /**
   * 取消订单
   */
  cancelOrder: function() {
    this.setData({
      showCancelModal: true,
      cancelReason: ''
    })
  },

  /**
   * 隐藏取消订单弹窗
   */
  hideCancelModal: function() {
    this.setData({
      showCancelModal: false,
      cancelReason: ''
    })
  },

  /**
   * 取消原因输入
   */
  onCancelReasonInput: function(e) {
    this.setData({
      cancelReason: e.detail.value
    })
  },

  /**
   * 确认取消订单
   */
  confirmCancel: function() {
    const { orderId, cancelReason } = this.data
    
    if (!cancelReason.trim()) {
      wx.showToast({
        title: '请输入取消原因',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('取消中...')
    
    app.request(`/api/orders/${orderId}/cancel`, {
      reason: cancelReason.trim()
    }, 'PUT').then(res => {
      wx.showToast({
        title: '订单已取消',
        icon: 'success'
      })
      this.hideCancelModal()
      this.loadOrderDetail()
    }).catch(error => {
      wx.showToast({
        title: error.message || '取消失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 删除订单
   */
  deleteOrder: function() {
    this.setData({
      showDeleteModal: true
    })
  },

  /**
   * 隐藏删除订单弹窗
   */
  hideDeleteModal: function() {
    this.setData({
      showDeleteModal: false
    })
  },

  /**
   * 确认删除订单
   */
  confirmDelete: function() {
    const { orderId } = this.data
    
    app.showLoading('删除中...')
    
    app.request(`/api/orders/${orderId}`, {}, 'DELETE').then(res => {
      wx.showToast({
        title: '订单已删除',
        icon: 'success'
      })
      this.hideDeleteModal()
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch(error => {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 支付订单
   */
  payOrder: function() {
    const { orderInfo } = this.data
    
    wx.navigateTo({
      url: `/pages/order/payment/payment?order_id=${orderInfo.id}&amount=${orderInfo.final_amount}`
    })
  },

  /**
   * 查看物流
   */
  viewLogistics: function() {
    const { orderId } = this.data
    
    wx.navigateTo({
      url: `/pages/order/logistics/logistics?order_id=${orderId}`
    })
  },

  /**
   * 确认收货
   */
  confirmReceive: function() {
    const { orderId } = this.data
    
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          this.doConfirmReceive(orderId)
        }
      }
    })
  },

  /**
   * 执行确认收货
   */
  doConfirmReceive: function(orderId) {
    app.showLoading('确认中...')
    
    app.request(`/api/orders/${orderId}/confirm`, {}, 'PUT').then(res => {
      wx.showToast({
        title: '确认收货成功',
        icon: 'success'
      })
      this.loadOrderDetail()
    }).catch(error => {
      wx.showToast({
        title: error.message || '确认失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 评价商品
   */
  goToReview: function() {
    const { orderId } = this.data
    
    wx.navigateTo({
      url: `/pages/order/review/review?order_id=${orderId}`
    })
  },

  /**
   * 再次购买
   */
  buyAgain: function() {
    const { orderInfo } = this.data
    
    if (orderInfo.items && orderInfo.items.length > 0) {
      this.addToCartAgain(orderInfo.items)
    }
  },

  /**
   * 重新加入购物车
   */
  addToCartAgain: function(items) {
    app.showLoading('添加中...')
    
    const promises = items.map(item => {
      return app.request('/api/cart/add', {
        product_id: item.product_id,
        sku_id: item.sku_id,
        quantity: item.quantity
      }, 'POST')
    })
    
    Promise.all(promises).then(() => {
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success'
      })
      // 跳转到购物车
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/cart/cart'
        })
      }, 1500)
    }).catch(error => {
      wx.showToast({
        title: '添加失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 联系客服
   */
  contactService: function() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话：400-123-4567\n工作时间：9:00-18:00',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '订单详情',
      path: `/pages/order/detail/detail?id=${this.data.orderId}`
    }
  }
})