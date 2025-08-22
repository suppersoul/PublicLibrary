// pages/product/product.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    productId: null,
    product: {},
    selectedSku: {},
    selectedSpecs: {},
    quantity: 1,
    showSpecSelector: false,
    reviews: [],
    recommendProducts: [],
    cartCount: 0,
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.id) {
      this.setData({
        productId: options.id
      })
      this.loadProductDetail()
    } else {
      wx.showToast({
        title: '商品不存在',
        icon: 'error'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.updateCartCount()
  },

  /**
   * 加载商品详情
   */
  loadProductDetail: function() {
    const { productId } = this.data
    app.showLoading('加载中...')
    
    // 并行加载商品详情、评价和推荐商品
    Promise.all([
      app.request(`/api/products/${productId}`),
      app.request(`/api/products/${productId}/reviews`, { page: 1, limit: 3 }),
      app.request(`/api/products/recommend/list`, { exclude_id: productId, limit: 10 })
    ]).then(([productRes, reviewsRes, recommendRes]) => {
      const product = productRes.data
      
      // 初始化默认SKU
      let selectedSku = {}
      if (product.skus && product.skus.length > 0) {
        selectedSku = product.skus[0]
      } else {
        selectedSku = {
          price: product.price,
          original_price: product.original_price,
          stock: product.stock,
          image: product.image
        }
      }

      this.setData({
        product: product,
        selectedSku: selectedSku,
        reviews: reviewsRes.data || [],
        recommendProducts: recommendRes.data || [],
        loading: false
      })
      
      // 更新页面标题
      wx.setNavigationBarTitle({
        title: product.name
      })
      
    }).catch(error => {
      console.error('加载商品详情失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
      this.setData({
        loading: false
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 更新购物车数量
   */
  updateCartCount: function() {
    app.request('/api/cart/count').then(res => {
      this.setData({
        cartCount: res.data || 0
      })
    }).catch(err => {
      console.log('获取购物车数量失败:', err)
    })
  },

  /**
   * 图片预览
   */
  onPreviewImage: function(e) {
    const { src, urls } = e.currentTarget.dataset
    wx.previewImage({
      current: src,
      urls: urls || [src]
    })
  },

  /**
   * 显示规格选择器
   */
  showSpecModal: function() {
    this.setData({
      showSpecSelector: true
    })
  },

  /**
   * 隐藏规格选择器
   */
  hideSpecModal: function() {
    this.setData({
      showSpecSelector: false
    })
  },

  /**
   * 阻止事件冒泡
   */
  preventClose: function() {
    // 阻止事件冒泡，防止关闭弹窗
  },

  /**
   * 选择规格
   */
  selectSpec: function(e) {
    const { group, value, name } = e.currentTarget.dataset
    const { selectedSpecs, product } = this.data
    
    // 更新选中的规格
    selectedSpecs[group] = value
    
    // 查找对应的SKU
    let selectedSku = this.findMatchingSku(selectedSpecs)
    if (!selectedSku) {
      // 如果没找到匹配的SKU，使用默认值
      selectedSku = {
        price: product.price,
        original_price: product.original_price,
        stock: product.stock,
        image: product.image,
        spec_name: name
      }
    }
    
    this.setData({
      selectedSpecs: selectedSpecs,
      selectedSku: selectedSku,
      quantity: 1 // 重置数量
    })
  },

  /**
   * 根据选中规格查找匹配的SKU
   */
  findMatchingSku: function(selectedSpecs) {
    const { product } = this.data
    if (!product.skus) return null
    
    return product.skus.find(sku => {
      // 检查是否所有规格都匹配
      return Object.keys(selectedSpecs).every(specName => {
        return sku.specs && sku.specs[specName] === selectedSpecs[specName]
      })
    })
  },

  /**
   * 减少数量
   */
  decreaseQuantity: function() {
    const { quantity } = this.data
    if (quantity > 1) {
      this.setData({
        quantity: quantity - 1
      })
    }
  },

  /**
   * 增加数量
   */
  increaseQuantity: function() {
    const { quantity, selectedSku, product } = this.data
    const maxStock = selectedSku.stock || product.stock
    
    if (quantity < maxStock) {
      this.setData({
        quantity: quantity + 1
      })
    } else {
      wx.showToast({
        title: '库存不足',
        icon: 'error'
      })
    }
  },

  /**
   * 数量输入变化
   */
  onQuantityChange: function(e) {
    const value = parseInt(e.detail.value) || 1
    const { selectedSku, product } = this.data
    const maxStock = selectedSku.stock || product.stock
    
    if (value < 1) {
      this.setData({ quantity: 1 })
    } else if (value > maxStock) {
      this.setData({ quantity: maxStock })
      wx.showToast({
        title: '超出库存限制',
        icon: 'error'
      })
    } else {
      this.setData({ quantity: value })
    }
  },

  /**
   * 切换收藏状态
   */
  toggleFavorite: function() {
    const { product } = this.data
    const action = product.is_favorite ? 'remove' : 'add'
    
    app.request(`/api/products/${product.id}/favorite`, {
      action: action
    }, 'POST').then(res => {
      this.setData({
        'product.is_favorite': !product.is_favorite
      })
      wx.showToast({
        title: product.is_favorite ? '已取消收藏' : '已收藏',
        icon: 'success'
      })
    }).catch(error => {
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      })
    })
  },

  /**
   * 跳转到购物车
   */
  goToCart: function() {
    wx.switchTab({
      url: '/pages/cart/cart'
    })
  },

  /**
   * 跳转到商品页面
   */
  goToProduct: function(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/product/product?id=${id}`
    })
  },

  /**
   * 跳转到评价页面
   */
  goToReviews: function() {
    const { productId } = this.data
    wx.navigateTo({
      url: `/pages/reviews/reviews?product_id=${productId}`
    })
  },

  /**
   * 加入购物车
   */
  addToCart: function() {
    const { product, selectedSku } = this.data
    
    // 如果有多个规格且未选择，显示规格选择器
    if (product.skus && product.skus.length > 1 && !selectedSku.id) {
      this.showSpecModal()
      return
    }
    
    this.doAddToCart()
  },

  /**
   * 确认加入购物车（从规格选择器）
   */
  confirmAddToCart: function() {
    this.doAddToCart()
    this.hideSpecModal()
  },

  /**
   * 执行加入购物车
   */
  doAddToCart: function() {
    const { productId, selectedSku, quantity } = this.data
    
    app.showLoading('加入中...')
    
    app.request('/api/cart/add', {
      product_id: productId,
      sku_id: selectedSku.id || null,
      quantity: quantity
    }, 'POST').then(res => {
      wx.showToast({
        title: '已加入购物车',
        icon: 'success'
      })
      this.updateCartCount()
    }).catch(error => {
      wx.showToast({
        title: error.message || '加入购物车失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 立即购买
   */
  buyNow: function() {
    const { product, selectedSku } = this.data
    
    // 如果有多个规格且未选择，显示规格选择器
    if (product.skus && product.skus.length > 1 && !selectedSku.id) {
      this.showSpecModal()
      return
    }
    
    this.doBuyNow()
  },

  /**
   * 确认立即购买（从规格选择器）
   */
  confirmBuyNow: function() {
    this.doBuyNow()
    this.hideSpecModal()
  },

  /**
   * 执行立即购买
   */
  doBuyNow: function() {
    const { productId, selectedSku, quantity } = this.data
    
    // 构造订单商品数据
    const orderItems = [{
      product_id: productId,
      sku_id: selectedSku.id || null,
      quantity: quantity,
      price: selectedSku.price,
      product_name: this.data.product.name,
      product_image: selectedSku.image || this.data.product.image,
      spec_name: selectedSku.spec_name || ''
    }]
    
    // 跳转到订单确认页面
    wx.navigateTo({
      url: `/pages/order/confirm/confirm?data=${encodeURIComponent(JSON.stringify(orderItems))}&from=product`
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    const { product } = this.data
    return {
      title: product.name,
      path: `/pages/product/product?id=${product.id}`,
      imageUrl: product.image
    }
  },

  /**
   * 页面分享到朋友圈
   */
  onShareTimeline: function() {
    const { product } = this.data
    return {
      title: product.name,
      imageUrl: product.image
    }
  }
})