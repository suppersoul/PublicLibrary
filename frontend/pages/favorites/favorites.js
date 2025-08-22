// pages/favorites/favorites.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    favorites: [],
    loading: true,
    isEditMode: false,
    allSelected: false,
    hasSelected: false,
    selectedCount: 0,
    showDeleteModal: false,
    showSuccessToast: false,
    successMessage: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadFavorites()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadFavorites()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadFavorites().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载收藏列表
   */
  loadFavorites: function() {
    this.setData({ loading: true })
    
    return app.request('/api/favorites').then(res => {
      const favorites = res.data || []
      
      // 为每个收藏项添加选中状态
      favorites.forEach(item => {
        item.selected = false
      })
      
      this.setData({
        favorites: favorites,
        loading: false
      })
      
      this.updateSelectionStatus()
    }).catch(error => {
      console.error('加载收藏失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({ loading: false })
    })
  },

  /**
   * 切换编辑模式
   */
  toggleEditMode: function() {
    const isEditMode = !this.data.isEditMode
    
    if (!isEditMode) {
      // 退出编辑模式，清除所有选中状态
      const favorites = this.data.favorites.map(item => ({
        ...item,
        selected: false
      }))
      
      this.setData({
        favorites: favorites,
        allSelected: false,
        hasSelected: false,
        selectedCount: 0
      })
    }
    
    this.setData({ isEditMode })
  },

  /**
   * 切换单个商品选中状态
   */
  toggleSelect: function(e) {
    const id = e.currentTarget.dataset.id
    const favorites = this.data.favorites.map(item => {
      if (item.id === id) {
        return { ...item, selected: !item.selected }
      }
      return item
    })
    
    this.setData({ favorites })
    this.updateSelectionStatus()
  },

  /**
   * 切换全选状态
   */
  toggleSelectAll: function() {
    const allSelected = !this.data.allSelected
    const favorites = this.data.favorites.map(item => ({
      ...item,
      selected: allSelected
    }))
    
    this.setData({ favorites })
    this.updateSelectionStatus()
  },

  /**
   * 更新选择状态
   */
  updateSelectionStatus: function() {
    const { favorites } = this.data
    const selectedItems = favorites.filter(item => item.selected)
    const allSelected = favorites.length > 0 && selectedItems.length === favorites.length
    const hasSelected = selectedItems.length > 0
    
    this.setData({
      allSelected,
      hasSelected,
      selectedCount: selectedItems.length
    })
  },

  /**
   * 跳转到商品详情
   */
  goToProduct: function(e) {
    if (this.data.isEditMode) {
      return // 编辑模式下不跳转
    }
    
    const productId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/product/product?id=${productId}`
    })
  },

  /**
   * 加入购物车
   */
  addToCart: function(e) {
    const item = e.currentTarget.dataset.item
    
    if (!item.in_stock) {
      wx.showToast({
        title: '商品缺货',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('添加中...')
    
    app.request('/api/cart/add', {
      product_id: item.product_id,
      sku_id: item.sku_id,
      quantity: 1
    }, 'POST').then(res => {
      this.showSuccessToast('已加入购物车')
    }).catch(error => {
      wx.showToast({
        title: error.message || '添加失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 立即购买
   */
  buyNow: function(e) {
    const item = e.currentTarget.dataset.item
    
    if (!item.in_stock) {
      wx.showToast({
        title: '商品缺货',
        icon: 'error'
      })
      return
    }
    
    // 构造订单数据
    const orderData = [{
      product_id: item.product_id,
      sku_id: item.sku_id,
      quantity: 1,
      product_name: item.product_name,
      product_image: item.product_image,
      spec_name: item.spec_name,
      price: item.price
    }]
    
    // 跳转到订单确认页面
    wx.navigateTo({
      url: `/pages/order/confirm/confirm?data=${encodeURIComponent(JSON.stringify(orderData))}`
    })
  },

  /**
   * 批量删除
   */
  batchDelete: function() {
    const selectedItems = this.data.favorites.filter(item => item.selected)
    
    if (selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要删除的商品',
        icon: 'error'
      })
      return
    }
    
    this.setData({ showDeleteModal: true })
  },

  /**
   * 隐藏删除弹窗
   */
  hideDeleteModal: function() {
    this.setData({ showDeleteModal: false })
  },

  /**
   * 确认删除
   */
  confirmDelete: function() {
    const selectedItems = this.data.favorites.filter(item => item.selected)
    const selectedIds = selectedItems.map(item => item.id)
    
    app.showLoading('删除中...')
    
    app.request('/api/favorites/batch-delete', {
      favorite_ids: selectedIds
    }, 'POST').then(res => {
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      
      // 重新加载收藏列表
      this.loadFavorites()
      this.hideDeleteModal()
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
   * 批量加入购物车
   */
  batchAddToCart: function() {
    const selectedItems = this.data.favorites.filter(item => item.selected && item.in_stock)
    
    if (selectedItems.length === 0) {
      wx.showToast({
        title: '选中的商品都缺货',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('添加中...')
    
    const promises = selectedItems.map(item => {
      return app.request('/api/cart/add', {
        product_id: item.product_id,
        sku_id: item.sku_id,
        quantity: 1
      }, 'POST')
    })
    
    Promise.all(promises).then(() => {
      this.showSuccessToast(`已添加${selectedItems.length}件商品到购物车`)
      
      // 退出编辑模式
      this.toggleEditMode()
    }).catch(error => {
      wx.showToast({
        title: '部分商品添加失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 显示成功提示
   */
  showSuccessToast: function(message) {
    this.setData({
      showSuccessToast: true,
      successMessage: message
    })
    
    setTimeout(() => {
      this.setData({ showSuccessToast: false })
    }, 2000)
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
      title: '我的收藏',
      path: '/pages/favorites/favorites'
    }
  }
})