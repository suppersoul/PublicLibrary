// pages/order/logistics/logistics.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    orderId: null,
    orderInfo: {},
    logistics: {},
    loading: true
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
      this.loadLogistics()
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
    }).catch(error => {
      console.error('加载订单信息失败:', error)
      wx.showToast({
        title: '加载订单信息失败',
        icon: 'error'
      })
    })
  },

  /**
   * 加载物流信息
   */
  loadLogistics: function() {
    const { orderId } = this.data
    
    app.request(`/api/orders/${orderId}/logistics`).then(res => {
      const logistics = res.data || {}
      
      // 处理物流轨迹数据
      if (logistics.tracks && Array.isArray(logistics.tracks)) {
        logistics.tracks = logistics.tracks.map(track => ({
          ...track,
          time: this.formatTime(track.time)
        }))
      }
      
      this.setData({
        logistics: logistics,
        loading: false
      })
    }).catch(error => {
      console.error('加载物流信息失败:', error)
      this.setData({ loading: false })
      
      // 如果是404错误，说明还没有物流信息
      if (error.status === 404) {
        this.setData({
          logistics: {}
        })
      } else {
        wx.showToast({
          title: '加载物流信息失败',
          icon: 'error'
        })
      }
    })
  },

  /**
   * 格式化时间
   */
  formatTime: function(timeStr) {
    if (!timeStr) return ''
    
    const date = new Date(timeStr)
    const now = new Date()
    const diff = now - date
    
    // 如果是今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    
    // 如果是昨天
    if (diff < 48 * 60 * 60 * 1000 && date.getDate() === now.getDate() - 1) {
      return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    }
    
    // 其他时间
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  },

  /**
   * 获取订单状态文本
   */
  getStatusText: function(status) {
    const statusMap = {
      'pending': '待付款',
      'paid': '已付款',
      'shipped': '已发货',
      'delivered': '已送达',
      'completed': '已完成',
      'cancelled': '已取消'
    }
    return statusMap[status] || '未知状态'
  },

  /**
   * 复制运单号
   */
  copyTrackingNumber: function(e) {
    const trackingNumber = e.currentTarget.dataset.number
    
    wx.setClipboardData({
      data: trackingNumber,
      success: () => {
        wx.showToast({
          title: '运单号已复制',
          icon: 'success'
        })
      }
    })
  },

  /**
   * 拨打物流公司电话
   */
  callPhone: function(e) {
    const phone = e.currentTarget.dataset.phone
    
    wx.makePhoneCall({
      phoneNumber: phone,
      success: () => {
        console.log('拨打电话成功')
      },
      fail: (error) => {
        console.error('拨打电话失败:', error)
        wx.showToast({
          title: '拨打电话失败',
          icon: 'error'
        })
      }
    })
  },

  /**
   * 刷新物流信息
   */
  refreshLogistics: function() {
    this.setData({ loading: true })
    
    // 延迟一下，让用户看到刷新状态
    setTimeout(() => {
      this.loadLogistics()
    }, 500)
    
    wx.showToast({
      title: '正在刷新',
      icon: 'loading'
    })
  },

  /**
   * 联系客服
   */
  contactService: function() {
    // 这里可以跳转到客服页面或打开客服会话
    wx.showModal({
      title: '联系客服',
      content: '客服电话：400-123-4567\n工作时间：9:00-18:00',
      confirmText: '拨打电话',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: '400-123-4567'
          })
        }
      }
    })
  },

  /**
   * 页面分享
   */
  onShareAppMessage: function () {
    return {
      title: '物流跟踪',
      path: `/pages/order/logistics/logistics?order_id=${this.data.orderId}`
    }
  }
})