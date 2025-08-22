// pages/order/review/review.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    orderId: null,
    orderInfo: {},
    rating: 5,
    ratingText: '非常满意',
    reviewTags: [
      { id: 1, name: '质量很好', selected: false },
      { id: 2, name: '包装精美', selected: false },
      { id: 3, name: '物流快', selected: false },
      { id: 4, name: '服务态度好', selected: false },
      { id: 5, name: '性价比高', selected: false },
      { id: 6, name: '新鲜', selected: false },
      { id: 7, name: '口感好', selected: false },
      { id: 8, name: '分量足', selected: false }
    ],
    reviewContent: '',
    uploadedImages: [],
    isAnonymous: false,
    loading: false,
    canSubmit: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    if (options.order_id) {
      this.setData({
        orderId: options.order_id
      })
      this.loadOrderInfo()
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
      const orderInfo = res.data
      
      this.setData({
        orderInfo: orderInfo
      })
      
      this.checkCanSubmit()
    }).catch(error => {
      console.error('加载订单信息失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    })
  },

  /**
   * 设置评分
   */
  setRating: function(e) {
    const rating = e.currentTarget.dataset.rating
    const ratingTextMap = {
      1: '非常不满意',
      2: '不满意',
      3: '一般',
      4: '满意',
      5: '非常满意'
    }
    
    this.setData({
      rating: rating,
      ratingText: ratingTextMap[rating]
    })
    
    this.checkCanSubmit()
  },

  /**
   * 切换标签选择
   */
  toggleTag: function(e) {
    const tagId = e.currentTarget.dataset.id
    const reviewTags = this.data.reviewTags.map(tag => {
      if (tag.id === tagId) {
        return { ...tag, selected: !tag.selected }
      }
      return tag
    })
    
    this.setData({ reviewTags })
  },

  /**
   * 评价内容输入
   */
  onContentInput: function(e) {
    this.setData({
      reviewContent: e.detail.value
    })
    this.checkCanSubmit()
  },

  /**
   * 选择图片
   */
  chooseImage: function() {
    const { uploadedImages } = this.data
    const remainingCount = 6 - uploadedImages.length
    
    wx.chooseImage({
      count: remainingCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFilePaths
        this.uploadImages(newImages)
      }
    })
  },

  /**
   * 上传图片
   */
  uploadImages: function(imagePaths) {
    app.showLoading('上传中...')
    
    const uploadPromises = imagePaths.map(imagePath => {
      return this.uploadSingleImage(imagePath)
    })
    
    Promise.all(uploadPromises).then(uploadedUrls => {
      const newImages = this.data.uploadedImages.concat(uploadedUrls)
      this.setData({
        uploadedImages: newImages
      })
      
      wx.hideLoading()
      wx.showToast({
        title: '图片上传成功',
        icon: 'success'
      })
    }).catch(error => {
      wx.hideLoading()
      wx.showToast({
        title: '部分图片上传失败',
        icon: 'error'
      })
    })
  },

  /**
   * 上传单张图片
   */
  uploadSingleImage: function(imagePath) {
    return new Promise((resolve, reject) => {
      // 这里应该调用文件上传API
      // 目前先返回本地路径
      setTimeout(() => {
        resolve(imagePath)
      }, 500)
    })
  },

  /**
   * 删除图片
   */
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index
    const uploadedImages = this.data.uploadedImages.filter((_, i) => i !== index)
    
    this.setData({ uploadedImages })
  },

  /**
   * 切换匿名评价
   */
  toggleAnonymous: function() {
    this.setData({
      isAnonymous: !this.data.isAnonymous
    })
  },

  /**
   * 检查是否可以提交
   */
  checkCanSubmit: function() {
    const { rating, reviewContent } = this.data
    const canSubmit = rating > 0 && reviewContent.trim().length > 0
    
    this.setData({ canSubmit })
  },

  /**
   * 提交评价
   */
  submitReview: function() {
    const { 
      orderId, 
      rating, 
      reviewContent, 
      reviewTags, 
      uploadedImages, 
      isAnonymous 
    } = this.data
    
    if (!rating || rating < 1) {
      wx.showToast({
        title: '请选择评分',
        icon: 'error'
      })
      return
    }
    
    if (!reviewContent.trim()) {
      wx.showToast({
        title: '请填写评价内容',
        icon: 'error'
      })
      return
    }
    
    this.setData({ loading: true })
    
    // 获取选中的标签
    const selectedTags = reviewTags.filter(tag => tag.selected).map(tag => tag.name)
    
    const reviewData = {
      order_id: orderId,
      rating: rating,
      content: reviewContent.trim(),
      tags: selectedTags,
      images: uploadedImages,
      is_anonymous: isAnonymous
    }
    
    app.request('/api/reviews', reviewData, 'POST').then(res => {
      wx.showToast({
        title: '评价提交成功',
        icon: 'success'
      })
      
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch(error => {
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'error'
      })
    }).finally(() => {
      this.setData({ loading: false })
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '商品评价',
      path: '/pages/order/review/review'
    }
  }
})