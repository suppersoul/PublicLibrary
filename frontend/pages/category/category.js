// pages/category/category.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    categories: [],
    products: [],
    selectedCategoryId: 0,
    selectedSortType: 'default', // default, price_asc, price_desc, sales, newest
    searchKeyword: '',
    loading: true,
    loadingMore: false,
    hasMore: true,
    page: 1,
    limit: 10
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取传入的分类ID
    if (options.category_id) {
      this.setData({
        selectedCategoryId: parseInt(options.category_id)
      })
    }
    
    this.loadCategories()
    this.loadProducts()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 页面显示时可以刷新数据
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.refreshData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 上拉加载更多
   */
  onReachBottom: function () {
    this.loadMoreProducts()
  },

  /**
   * 加载分类列表
   */
  loadCategories: function() {
    app.request('/api/categories/list').then(res => {
      // 添加"全部"选项
      const allCategories = [
        { id: 0, name: '全部', icon: '', product_count: 0 },
        ...(res.data || [])
      ]
      
      this.setData({
        categories: allCategories
      })
    }).catch(error => {
      console.error('加载分类失败:', error)
    })
  },

  /**
   * 加载商品列表
   */
  loadProducts: function() {
    const { selectedCategoryId, selectedSortType, searchKeyword, page, limit } = this.data
    
    this.setData({ 
      loading: page === 1,
      loadingMore: page > 1
    })
    
    const params = {
      page: page,
      limit: limit,
      sort: selectedSortType
    }
    
    // 添加分类筛选
    if (selectedCategoryId > 0) {
      params.category_id = selectedCategoryId
    }
    
    // 添加搜索关键词
    if (searchKeyword.trim()) {
      params.keyword = searchKeyword.trim()
    }
    
    app.request('/api/products', params).then(res => {
      const newProducts = res.data || []
      
      if (page === 1) {
        // 首页或刷新
        this.setData({
          products: newProducts,
          hasMore: newProducts.length >= limit
        })
      } else {
        // 加载更多
        this.setData({
          products: [...this.data.products, ...newProducts],
          hasMore: newProducts.length >= limit
        })
      }
    }).catch(error => {
      console.error('加载商品失败:', error)
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
   * 刷新数据
   */
  refreshData: function() {
    this.setData({
      page: 1,
      hasMore: true
    })
    return this.loadProducts()
  },

  /**
   * 加载更多商品
   */
  loadMoreProducts: function() {
    if (!this.data.hasMore || this.data.loadingMore) {
      return
    }
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadProducts()
  },

  /**
   * 搜索输入
   */
  onSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  /**
   * 搜索确认
   */
  onSearchConfirm: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
    this.refreshData()
  },

  /**
   * 清空搜索
   */
  onSearchClear: function() {
    this.setData({
      searchKeyword: ''
    })
    this.refreshData()
  },

  /**
   * 选择分类
   */
  onCategorySelect: function(e) {
    const categoryId = e.currentTarget.dataset.id
    
    if (categoryId === this.data.selectedCategoryId) {
      return
    }
    
    this.setData({
      selectedCategoryId: categoryId
    })
    this.refreshData()
  },

  /**
   * 选择排序方式
   */
  onSortSelect: function(e) {
    const sortType = e.currentTarget.dataset.type
    
    if (sortType === this.data.selectedSortType) {
      return
    }
    
    this.setData({
      selectedSortType: sortType
    })
    this.refreshData()
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
   * 加入购物车
   */
  addToCart: function(e) {
    const { id } = e.currentTarget.dataset
    
    app.request('/api/cart/add', {
      product_id: id,
      quantity: 1
    }, 'POST').then(res => {
      wx.showToast({
        title: '已加入购物车',
        icon: 'success'
      })
    }).catch(error => {
      if (error.code === 401) {
        // 未登录，跳转到登录页面
        wx.navigateTo({
          url: '/pages/login/login'
        })
      } else {
        wx.showToast({
          title: error.message || '加入失败',
          icon: 'error'
        })
      }
    })
  },

  /**
   * 跳转到搜索页面
   */
  goToSearch: function() {
    wx.navigateTo({
      url: `/pages/search/search?keyword=${this.data.searchKeyword}`
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    const { selectedCategoryId, categories } = this.data
    let title = '商品分类'
    
    if (selectedCategoryId > 0) {
      const category = categories.find(cat => cat.id === selectedCategoryId)
      if (category) {
        title = category.name
      }
    }
    
    return {
      title: title,
      path: `/pages/category/category?category_id=${selectedCategoryId}`
    }
  }
})