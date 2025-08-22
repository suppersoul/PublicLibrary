// pages/address/list/list.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    addresses: [],
    loading: true,
    showDeleteModal: false,
    deleteId: null,
    fromSelect: false // 是否来自地址选择
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查是否来自地址选择
    if (options.from === 'select') {
      this.setData({
        fromSelect: true
      })
    }
    
    this.loadAddresses()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadAddresses()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadAddresses().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载地址列表
   */
  loadAddresses: function() {
    this.setData({ loading: true })
    
    return app.request('/api/addresses').then(res => {
      this.setData({
        addresses: res.data || [],
        loading: false
      })
    }).catch(error => {
      console.error('加载地址列表失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({
        loading: false
      })
    })
  },

  /**
   * 选择地址
   */
  selectAddress: function(e) {
    if (!this.data.fromSelect) {
      return
    }
    
    const address = e.currentTarget.dataset.address
    
    // 返回上一页并传递选中的地址
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    
    if (prevPage && prevPage.onAddressSelected) {
      prevPage.onAddressSelected(address)
    }
    
    wx.navigateBack()
  },

  /**
   * 新增地址
   */
  addAddress: function() {
    wx.navigateTo({
      url: '/pages/address/edit/edit'
    })
  },

  /**
   * 编辑地址
   */
  editAddress: function(e) {
    const addressId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/address/edit/edit?id=${addressId}`
    })
  },

  /**
   * 设置默认地址
   */
  setDefault: function(e) {
    const addressId = e.currentTarget.dataset.id
    
    app.showLoading('设置中...')
    
    app.request(`/api/addresses/${addressId}/default`, {}, 'PUT').then(res => {
      wx.showToast({
        title: '设置成功',
        icon: 'success'
      })
      // 重新加载地址列表
      this.loadAddresses()
    }).catch(error => {
      wx.showToast({
        title: error.message || '设置失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 删除地址
   */
  deleteAddress: function(e) {
    const addressId = e.currentTarget.dataset.id
    
    this.setData({
      showDeleteModal: true,
      deleteId: addressId
    })
  },

  /**
   * 隐藏删除确认弹窗
   */
  hideDeleteModal: function() {
    this.setData({
      showDeleteModal: false,
      deleteId: null
    })
  },

  /**
   * 确认删除
   */
  confirmDelete: function() {
    const { deleteId } = this.data
    
    app.showLoading('删除中...')
    
    app.request(`/api/addresses/${deleteId}`, {}, 'DELETE').then(res => {
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      // 重新加载地址列表
      this.loadAddresses()
    }).catch(error => {
      wx.showToast({
        title: error.message || '删除失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
      this.hideDeleteModal()
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '收货地址管理',
      path: '/pages/address/list/list'
    }
  }
})