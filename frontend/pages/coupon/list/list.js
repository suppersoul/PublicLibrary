// pages/coupon/list/list.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    coupons: [],
    currentStatus: 'all',
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    limit: 20,
    showUseModal: false,
    selectedCoupon: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadCoupons()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadCoupons()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.refreshCoupons().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 页面上拉触底事件
   */
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadMore()
    }
  },

  /**
   * 加载优惠券列表
   */
  loadCoupons: function() {
    this.setData({ loading: true })
    
    const { currentStatus, page, limit } = this.data
    
    let url = `/api/coupons?page=${page}&limit=${limit}`
    if (currentStatus !== 'all') {
      url += `&status=${currentStatus}`
    }
    
    return app.request(url).then(res => {
      const coupons = res.data || []
      
      this.setData({
        coupons: page === 1 ? coupons : [...this.data.coupons, ...coupons],
        loading: false,
        hasMore: coupons.length === limit
      })
    }).catch(error => {
      console.error('加载优惠券失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({ loading: false })
    })
  },

  /**
   * 刷新优惠券列表
   */
  refreshCoupons: function() {
    this.setData({
      page: 1,
      hasMore: true
    })
    return this.loadCoupons()
  },

  /**
   * 加载更多
   */
  loadMore: function() {
    if (this.data.loadingMore || !this.data.hasMore) {
      return
    }
    
    this.setData({
      loadingMore: true,
      page: this.data.page + 1
    })
    
    this.loadCoupons().finally(() => {
      this.setData({ loadingMore: false })
    })
  },

  /**
   * 切换状态标签
   */
  switchStatus: function(e) {
    const status = e.currentTarget.dataset.status
    
    if (status === this.data.currentStatus) {
      return
    }
    
    this.setData({
      currentStatus: status,
      page: 1,
      hasMore: true
    })
    
    this.loadCoupons()
  },

  /**
   * 获取状态文本
   */
  getStatusText: function(status) {
    const statusMap = {
      'available': '可使用',
      'used': '已使用',
      'expired': '已过期'
    }
    return statusMap[status] || '未知'
  },

  /**
   * 使用优惠券
   */
  useCoupon: function(e) {
    const coupon = e.currentTarget.dataset.coupon
    
    this.setData({
      showUseModal: true,
      selectedCoupon: coupon
    })
  },

  /**
   * 隐藏使用弹窗
   */
  hideUseModal: function() {
    this.setData({
      showUseModal: false,
      selectedCoupon: {}
    })
  },

  /**
   * 确认使用优惠券
   */
  confirmUseCoupon: function() {
    const { selectedCoupon } = this.data
    
    // 跳转到商品列表页面，并传递优惠券信息
    wx.switchTab({
      url: '/pages/index/index'
    })
    
    // 隐藏弹窗
    this.hideUseModal()
    
    wx.showToast({
      title: '优惠券已选择',
      icon: 'success'
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
      title: '我的优惠券',
      path: '/pages/coupon/list/list'
    }
  }
})