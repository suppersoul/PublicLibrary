// pages/user/user.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    stats: {
      pending: 0,    // 待付款
      paid: 0,       // 待发货
      shipped: 0,    // 待收货
      delivered: 0,  // 待评价
      refund: 0      // 退款/售后
    },
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserData()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadUserData()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadUserData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载用户数据
   */
  loadUserData: function() {
    const token = wx.getStorageSync('token')
    
    if (!token) {
      this.setData({
        userInfo: {},
        stats: {},
        loading: false
      })
      return Promise.resolve()
    }

    this.setData({ loading: true })

    return Promise.all([
      this.loadUserInfo(),
      this.loadOrderStats()
    ]).finally(() => {
      this.setData({ loading: false })
    })
  },

  /**
   * 加载用户信息
   */
  loadUserInfo: function() {
    return app.request('/api/users/profile').then(res => {
      this.setData({
        userInfo: res.data || {}
      })
    }).catch(error => {
      console.error('获取用户信息失败:', error)
      if (error.code === 401) {
        // token过期，清除本地存储
        wx.removeStorageSync('token')
        wx.removeStorageSync('userInfo')
        this.setData({
          userInfo: {}
        })
      }
    })
  },

  /**
   * 加载订单统计
   */
  loadOrderStats: function() {
    return app.request('/api/orders/stats').then(res => {
      this.setData({
        stats: res.data || {}
      })
    }).catch(error => {
      console.error('获取订单统计失败:', error)
    })
  },

  /**
   * 跳转到用户资料页面
   */
  goToProfile: function() {
    if (!this.data.userInfo.id) {
      this.goToLogin()
      return
    }
    
    wx.navigateTo({
      url: '/pages/profile/profile'
    })
  },

  /**
   * 跳转到订单列表
   */
  goToOrders: function(e) {
    if (!this.data.userInfo.id) {
      this.goToLogin()
      return
    }

    const status = e.currentTarget.dataset.status || ''
    let url = '/pages/order/list/list'
    
    if (status) {
      url += `?status=${status}`
    }
    
    wx.navigateTo({ url })
  },

  /**
   * 跳转到收藏页面
   */
  goToFavorites: function() {
    if (!this.data.userInfo.id) {
      this.goToLogin()
      return
    }
    
    wx.navigateTo({
      url: '/pages/favorites/favorites'
    })
  },

  /**
   * 跳转到地址管理
   */
  goToAddress: function() {
    if (!this.data.userInfo.id) {
      this.goToLogin()
      return
    }
    
    wx.navigateTo({
      url: '/pages/address/list/list'
    })
  },

  /**
   * 跳转到优惠券页面
   */
  goToCoupons: function() {
    if (!this.data.userInfo.id) {
      this.goToLogin()
      return
    }
    
    wx.navigateTo({
      url: '/pages/coupons/coupons'
    })
  },

  /**
   * 跳转到客服页面
   */
  goToCustomerService: function() {
    wx.showModal({
      title: '联系客服',
      content: '客服电话：400-123-4567\n工作时间：9:00-18:00',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /**
   * 跳转到意见反馈
   */
  goToFeedback: function() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    })
  },

  /**
   * 跳转到关于我们
   */
  goToAbout: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  /**
   * 跳转到设置页面
   */
  goToSettings: function() {
    if (!this.data.userInfo.id) {
      this.goToLogin()
      return
    }
    
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  /**
   * 跳转到登录页面
   */
  goToLogin: function() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  /**
   * 退出登录
   */
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.doLogout()
        }
      }
    })
  },

  /**
   * 执行退出登录
   */
  doLogout: function() {
    app.showLoading('退出中...')
    
    // 调用退出登录API
    app.request('/api/auth/logout', {}, 'POST').then(res => {
      // 清除本地存储
      wx.removeStorageSync('token')
      wx.removeStorageSync('userInfo')
      
      this.setData({
        userInfo: {},
        stats: {}
      })
      
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      })
    }).catch(error => {
      console.error('退出登录失败:', error)
      // 即使API调用失败，也清除本地存储
      wx.removeStorageSync('token')
      wx.removeStorageSync('userInfo')
      
      this.setData({
        userInfo: {},
        stats: {}
      })
      
      wx.showToast({
        title: '已退出登录',
        icon: 'success'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '笑姐家农产品',
      path: '/pages/index/index'
    }
  },

  /**
   * 页面分享到朋友圈
   */
  onShareTimeline: function() {
    return {
      title: '笑姐家农产品'
    }
  }
})