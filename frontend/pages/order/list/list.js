// pages/order/list/list.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    orders: [],
    currentStatus: '',
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    limit: 10,
    showCancelModal: false,
    showDeleteModal: false,
    cancelReason: '',
    currentOrderId: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取传入的状态参数
    if (options.status) {
      this.setData({
        currentStatus: options.status
      })
    }
    
    this.loadOrders()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadOrders()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.refreshOrders().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 上拉加载更多
   */
  onReachBottom: function () {
    this.loadMoreOrders()
  },

  /**
   * 加载订单列表
   */
  loadOrders: function() {
    const { currentStatus, page, limit } = this.data
    
    this.setData({ 
      loading: page === 1,
      loadingMore: page > 1
    })
    
    const params = {
      page: page,
      limit: limit
    }
    
    if (currentStatus) {
      params.status = currentStatus
    }
    
    app.request('/api/orders', params).then(res => {
      const newOrders = res.data || []
      
      if (page === 1) {
        // 首页或刷新
        this.setData({
          orders: newOrders,
          hasMore: newOrders.length >= limit
        })
      } else {
        // 加载更多
        this.setData({
          orders: [...this.data.orders, ...newOrders],
          hasMore: newOrders.length >= limit
        })
      }
    }).catch(error => {
      console.error('加载订单失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    }).finally(() => {
      this.setData({
        loading: false,
        loadingMore: false
      })
    })
  },

  /**
   * 刷新订单
   */
  refreshOrders: function() {
    this.setData({
      page: 1,
      hasMore: true
    })
    return this.loadOrders()
  },

  /**
   * 加载更多订单
   */
  loadMoreOrders: function() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadOrders()
  },

  /**
   * 切换订单状态
   */
  switchStatus: function(e) {
    const status = e.currentTarget.dataset.status
    
    if (status === this.data.currentStatus) {
      return
    }
    
    this.setData({
      currentStatus: status
    })
    this.refreshOrders()
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
   * 取消订单
   */
  cancelOrder: function(e) {
    const orderId = e.currentTarget.dataset.id
    
    this.setData({
      showCancelModal: true,
      currentOrderId: orderId,
      cancelReason: ''
    })
  },

  /**
   * 隐藏取消订单弹窗
   */
  hideCancelModal: function() {
    this.setData({
      showCancelModal: false,
      currentOrderId: null,
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
    const { currentOrderId, cancelReason } = this.data
    
    if (!cancelReason.trim()) {
      wx.showToast({
        title: '请输入取消原因',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('取消中...')
    
    app.request(`/api/orders/${currentOrderId}/cancel`, {
      reason: cancelReason.trim()
    }, 'PUT').then(res => {
      wx.showToast({
        title: '订单已取消',
        icon: 'success'
      })
      this.hideCancelModal()
      this.refreshOrders()
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
  deleteOrder: function(e) {
    const orderId = e.currentTarget.dataset.id
    
    this.setData({
      showDeleteModal: true,
      currentOrderId: orderId
    })
  },

  /**
   * 隐藏删除订单弹窗
   */
  hideDeleteModal: function() {
    this.setData({
      showDeleteModal: false,
      currentOrderId: null
    })
  },

  /**
   * 确认删除订单
   */
  confirmDelete: function() {
    const { currentOrderId } = this.data
    
    app.showLoading('删除中...')
    
    app.request(`/api/orders/${currentOrderId}`, {}, 'DELETE').then(res => {
      wx.showToast({
        title: '订单已删除',
        icon: 'success'
      })
      this.hideDeleteModal()
      this.refreshOrders()
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
  payOrder: function(e) {
    const { id, amount } = e.currentTarget.dataset
    
    wx.navigateTo({
      url: `/pages/order/payment/payment?order_id=${id}&amount=${amount}`
    })
  },

  /**
   * 查看物流
   */
  viewLogistics: function(e) {
    const orderId = e.currentTarget.dataset.id
    
    wx.navigateTo({
      url: `/pages/order/logistics/logistics?order_id=${orderId}`
    })
  },

  /**
   * 确认收货
   */
  confirmReceive: function(e) {
    const orderId = e.currentTarget.dataset.id
    
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
      this.refreshOrders()
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
  goToReview: function(e) {
    const orderId = e.currentTarget.dataset.id
    
    wx.navigateTo({
      url: `/pages/order/review/review?order_id=${orderId}`
    })
  },

  /**
   * 再次购买
   */
  buyAgain: function(e) {
    const orderId = e.currentTarget.dataset.id
    
    // 获取订单商品信息，重新加入购物车
    const order = this.data.orders.find(o => o.id === orderId)
    if (order && order.items) {
      this.addToCartAgain(order.items)
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
   * 去首页
   */
  goToIndex: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '我的订单',
      path: '/pages/order/list/list'
    }
  }
})