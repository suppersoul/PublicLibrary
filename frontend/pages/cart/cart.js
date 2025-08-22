// pages/cart/cart.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    cartItems: [],
    recommendProducts: [],
    loading: true,
    isAllSelected: false,
    selectedCount: 0,
    totalPrice: '0.00',
    originalPrice: '0.00',
    showDeleteModal: false,
    showClearModal: false,
    deleteIndex: -1
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadCartData()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.loadCartData()
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadCartData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 加载购物车数据
   */
  loadCartData: function() {
    this.setData({ loading: true })
    
    return Promise.all([
      app.request('/api/cart'),
      app.request('/api/products/recommend/list', { limit: 10 })
    ]).then(([cartRes, recommendRes]) => {
      let cartItems = cartRes.data || []
      
      // 为每个商品添加选中状态
      cartItems = cartItems.map(item => ({
        ...item,
        checked: false
      }))
      
      this.setData({
        cartItems: cartItems,
        recommendProducts: recommendRes.data || [],
        loading: false
      })
      
      this.calculateTotal()
      
    }).catch(error => {
      console.error('加载购物车失败:', error)
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
   * 单个商品选择状态变化
   */
  onItemCheck: function(e) {
    const index = e.currentTarget.dataset.index
    const checked = e.detail.value.length > 0
    
    this.setData({
      [`cartItems[${index}].checked`]: checked
    })
    
    this.calculateTotal()
    this.checkAllSelected()
  },

  /**
   * 全选/取消全选
   */
  onSelectAll: function(e) {
    const isAllSelected = e.detail.value.length > 0
    const { cartItems } = this.data
    
    // 更新所有商品的选中状态
    const updatedItems = cartItems.map(item => ({
      ...item,
      checked: isAllSelected
    }))
    
    this.setData({
      cartItems: updatedItems,
      isAllSelected: isAllSelected
    })
    
    this.calculateTotal()
  },

  /**
   * 检查是否全选
   */
  checkAllSelected: function() {
    const { cartItems } = this.data
    const checkedItems = cartItems.filter(item => item.checked)
    const isAllSelected = cartItems.length > 0 && checkedItems.length === cartItems.length
    
    this.setData({
      isAllSelected: isAllSelected
    })
  },

  /**
   * 计算总价
   */
  calculateTotal: function() {
    const { cartItems } = this.data
    const selectedItems = cartItems.filter(item => item.checked)
    
    let totalPrice = 0
    let originalPrice = 0
    
    selectedItems.forEach(item => {
      totalPrice += parseFloat(item.price) * item.quantity
      originalPrice += parseFloat(item.original_price || item.price) * item.quantity
    })
    
    this.setData({
      selectedCount: selectedItems.length,
      totalPrice: totalPrice.toFixed(2),
      originalPrice: originalPrice.toFixed(2)
    })
  },

  /**
   * 减少商品数量
   */
  decreaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index
    const { cartItems } = this.data
    const item = cartItems[index]
    
    if (item.quantity <= 1) {
      return
    }
    
    this.updateQuantity(index, item.quantity - 1)
  },

  /**
   * 增加商品数量
   */
  increaseQuantity: function(e) {
    const index = e.currentTarget.dataset.index
    const { cartItems } = this.data
    const item = cartItems[index]
    
    if (item.quantity >= item.stock) {
      wx.showToast({
        title: '库存不足',
        icon: 'error'
      })
      return
    }
    
    this.updateQuantity(index, item.quantity + 1)
  },

  /**
   * 数量输入变化
   */
  onQuantityInput: function(e) {
    const index = e.currentTarget.dataset.index
    const value = parseInt(e.detail.value) || 1
    const { cartItems } = this.data
    const item = cartItems[index]
    
    if (value < 1) {
      this.setData({
        [`cartItems[${index}].quantity`]: 1
      })
      return
    }
    
    if (value > item.stock) {
      wx.showToast({
        title: '超出库存限制',
        icon: 'error'
      })
      this.setData({
        [`cartItems[${index}].quantity`]: item.stock
      })
      this.updateQuantity(index, item.stock)
      return
    }
    
    this.updateQuantity(index, value)
  },

  /**
   * 更新商品数量
   */
  updateQuantity: function(index, quantity) {
    const { cartItems } = this.data
    const item = cartItems[index]
    
    // 本地先更新
    this.setData({
      [`cartItems[${index}].quantity`]: quantity
    })
    this.calculateTotal()
    
    // 发送请求更新服务器
    app.request('/api/cart/update', {
      product_id: item.product_id,
      sku_id: item.sku_id,
      quantity: quantity
    }, 'PUT').catch(error => {
      console.error('更新数量失败:', error)
      // 失败时恢复原数量
      this.setData({
        [`cartItems[${index}].quantity`]: item.quantity
      })
      this.calculateTotal()
      wx.showToast({
        title: '更新失败',
        icon: 'error'
      })
    })
  },

  /**
   * 删除商品
   */
  deleteItem: function(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      showDeleteModal: true,
      deleteIndex: index
    })
  },

  /**
   * 隐藏删除确认弹窗
   */
  hideDeleteModal: function() {
    this.setData({
      showDeleteModal: false,
      deleteIndex: -1
    })
  },

  /**
   * 确认删除
   */
  confirmDelete: function() {
    const { deleteIndex, cartItems } = this.data
    const item = cartItems[deleteIndex]
    
    app.showLoading('删除中...')
    
    app.request(`/api/cart/remove/${item.product_id}`, {
      sku_id: item.sku_id
    }, 'DELETE').then(res => {
      // 删除成功，从列表中移除
      cartItems.splice(deleteIndex, 1)
      this.setData({
        cartItems: cartItems
      })
      this.calculateTotal()
      this.checkAllSelected()
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
    }).catch(error => {
      console.error('删除失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
      this.hideDeleteModal()
    })
  },

  /**
   * 清空购物车
   */
  clearCart: function() {
    this.setData({
      showClearModal: true
    })
  },

  /**
   * 隐藏清空确认弹窗
   */
  hideClearModal: function() {
    this.setData({
      showClearModal: false
    })
  },

  /**
   * 确认清空
   */
  confirmClear: function() {
    app.showLoading('清空中...')
    
    app.request('/api/cart/clear', {}, 'DELETE').then(res => {
      this.setData({
        cartItems: [],
        selectedCount: 0,
        totalPrice: '0.00',
        originalPrice: '0.00',
        isAllSelected: false
      })
      
      wx.showToast({
        title: '清空成功',
        icon: 'success'
      })
    }).catch(error => {
      console.error('清空失败:', error)
      wx.showToast({
        title: '清空失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
      this.hideClearModal()
    })
  },

  /**
   * 跳转到商品详情
   */
  goToProduct: function(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/product/product?id=${id}`
    })
  },

  /**
   * 推荐商品加入购物车
   */
  addRecommendToCart: function(e) {
    const { id } = e.currentTarget.dataset
    
    app.request('/api/cart/add', {
      product_id: id,
      quantity: 1
    }, 'POST').then(res => {
      wx.showToast({
        title: '已加入购物车',
        icon: 'success'
      })
      // 重新加载购物车数据
      this.loadCartData()
    }).catch(error => {
      wx.showToast({
        title: error.message || '加入失败',
        icon: 'error'
      })
    })
  },

  /**
   * 去逛逛
   */
  goToIndex: function() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  /**
   * 去结算
   */
  goToCheckout: function() {
    const { cartItems } = this.data
    const selectedItems = cartItems.filter(item => item.checked)
    
    if (selectedItems.length === 0) {
      wx.showToast({
        title: '请选择要结算的商品',
        icon: 'error'
      })
      return
    }
    
    // 检查库存
    const outOfStockItems = selectedItems.filter(item => item.quantity > item.stock)
    if (outOfStockItems.length > 0) {
      wx.showToast({
        title: '部分商品库存不足',
        icon: 'error'
      })
      return
    }
    
    // 构造订单商品数据
    const orderItems = selectedItems.map(item => ({
      product_id: item.product_id,
      sku_id: item.sku_id,
      quantity: item.quantity,
      price: item.price,
      product_name: item.product_name,
      product_image: item.product_image,
      spec_name: item.spec_name || ''
    }))
    
    // 跳转到订单确认页面
    wx.navigateTo({
      url: `/pages/order/confirm/confirm?data=${encodeURIComponent(JSON.stringify(orderItems))}&from=cart`
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '我的购物车',
      path: '/pages/cart/cart'
    }
  }
})