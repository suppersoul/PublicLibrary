// pages/profile/profile.js
const app = getApp()

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {},
    originalUserInfo: {}, // 保存原始数据用于比较
    genderOptions: ['保密', '男', '女'],
    genderIndex: 0,
    hasChanges: false,
    loading: false,
    
    // 手机绑定相关
    showPhoneModal: false,
    phoneNumber: '',
    verifyCode: '',
    countdown: 0,
    canSendCode: true,
    
    // 修改密码相关
    showPasswordModal: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserInfo()
  },

  /**
   * 加载用户信息
   */
  loadUserInfo: function() {
    app.request('/api/users/profile').then(res => {
      const userInfo = res.data || {}
      
      // 设置性别索引
      let genderIndex = 0
      if (userInfo.gender === 'male') genderIndex = 1
      else if (userInfo.gender === 'female') genderIndex = 2
      
      this.setData({
        userInfo: userInfo,
        originalUserInfo: JSON.parse(JSON.stringify(userInfo)), // 深拷贝
        genderIndex: genderIndex
      })
    }).catch(error => {
      console.error('加载用户信息失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      })
    })
  },

  /**
   * 检查是否有变化
   */
  checkChanges: function() {
    const { userInfo, originalUserInfo } = this.data
    const hasChanges = JSON.stringify(userInfo) !== JSON.stringify(originalUserInfo)
    
    this.setData({ hasChanges })
  },

  /**
   * 选择头像
   */
  chooseAvatar: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.uploadAvatar(tempFilePath)
      }
    })
  },

  /**
   * 上传头像
   */
  uploadAvatar: function(filePath) {
    app.showLoading('上传中...')
    
    // 这里应该调用文件上传API
    // 目前先模拟上传成功
    setTimeout(() => {
      this.setData({
        'userInfo.avatar': filePath
      })
      this.checkChanges()
      wx.hideLoading()
      wx.showToast({
        title: '头像上传成功',
        icon: 'success'
      })
    }, 1000)
  },

  /**
   * 昵称输入
   */
  onNicknameInput: function(e) {
    this.setData({
      'userInfo.nickname': e.detail.value
    })
    this.checkChanges()
  },

  /**
   * 性别选择
   */
  onGenderChange: function(e) {
    const genderIndex = e.detail.value
    const gender = genderIndex === 0 ? 'secret' : (genderIndex === 1 ? 'male' : 'female')
    
    this.setData({
      genderIndex: genderIndex,
      'userInfo.gender': gender
    })
    this.checkChanges()
  },

  /**
   * 生日选择
   */
  onBirthdayChange: function(e) {
    this.setData({
      'userInfo.birthday': e.detail.value
    })
    this.checkChanges()
  },

  /**
   * 邮箱输入
   */
  onEmailInput: function(e) {
    this.setData({
      'userInfo.email': e.detail.value
    })
    this.checkChanges()
  },

  /**
   * 绑定手机号
   */
  bindPhone: function() {
    this.setData({
      showPhoneModal: true,
      phoneNumber: '',
      verifyCode: ''
    })
  },

  /**
   * 更换手机号
   */
  changePhone: function() {
    this.setData({
      showPhoneModal: true,
      phoneNumber: this.data.userInfo.phone || '',
      verifyCode: ''
    })
  },

  /**
   * 隐藏手机弹窗
   */
  hidePhoneModal: function() {
    this.setData({
      showPhoneModal: false,
      phoneNumber: '',
      verifyCode: ''
    })
  },

  /**
   * 手机号输入
   */
  onPhoneInput: function(e) {
    this.setData({
      phoneNumber: e.detail.value
    })
  },

  /**
   * 验证码输入
   */
  onCodeInput: function(e) {
    this.setData({
      verifyCode: e.detail.value
    })
  },

  /**
   * 发送验证码
   */
  sendCode: function() {
    const { phoneNumber } = this.data
    
    if (!phoneNumber || !/^1[3-9]\d{9}$/.test(phoneNumber)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('发送中...')
    
    app.request('/api/auth/send-sms', {
      phone: phoneNumber,
      type: 'bind'
    }, 'POST').then(res => {
      wx.showToast({
        title: '验证码已发送',
        icon: 'success'
      })
      
      // 开始倒计时
      this.startCountdown()
    }).catch(error => {
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 开始倒计时
   */
  startCountdown: function() {
    this.setData({
      countdown: 60,
      canSendCode: false
    })
    
    const timer = setInterval(() => {
      if (this.data.countdown > 0) {
        this.setData({
          countdown: this.data.countdown - 1
        })
      } else {
        clearInterval(timer)
        this.setData({
          canSendCode: true
        })
      }
    }, 1000)
  },

  /**
   * 确认手机绑定
   */
  confirmPhone: function() {
    const { phoneNumber, verifyCode } = this.data
    
    if (!phoneNumber || !verifyCode) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('验证中...')
    
    app.request('/api/auth/verify-sms', {
      phone: phoneNumber,
      code: verifyCode,
      type: 'bind'
    }, 'POST').then(res => {
      // 更新用户信息
      this.setData({
        'userInfo.phone': phoneNumber
      })
      this.checkChanges()
      
      this.hidePhoneModal()
      wx.showToast({
        title: '手机号绑定成功',
        icon: 'success'
      })
    }).catch(error => {
      wx.showToast({
        title: error.message || '验证失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 修改密码
   */
  changePassword: function() {
    this.setData({
      showPasswordModal: true,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  },

  /**
   * 隐藏密码弹窗
   */
  hidePasswordModal: function() {
    this.setData({
      showPasswordModal: false,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  },

  /**
   * 原密码输入
   */
  onOldPasswordInput: function(e) {
    this.setData({
      oldPassword: e.detail.value
    })
  },

  /**
   * 新密码输入
   */
  onNewPasswordInput: function(e) {
    this.setData({
      newPassword: e.detail.value
    })
  },

  /**
   * 确认密码输入
   */
  onConfirmPasswordInput: function(e) {
    this.setData({
      confirmPassword: e.detail.value
    })
  },

  /**
   * 确认修改密码
   */
  confirmPassword: function() {
    const { oldPassword, newPassword, confirmPassword } = this.data
    
    if (!oldPassword || !newPassword || !confirmPassword) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'error'
      })
      return
    }
    
    if (newPassword !== confirmPassword) {
      wx.showToast({
        title: '两次密码不一致',
        icon: 'error'
      })
      return
    }
    
    if (newPassword.length < 6) {
      wx.showToast({
        title: '密码长度不能少于6位',
        icon: 'error'
      })
      return
    }
    
    app.showLoading('修改中...')
    
    app.request('/api/users/change-password', {
      old_password: oldPassword,
      new_password: newPassword
    }, 'PUT').then(res => {
      this.hidePasswordModal()
      wx.showToast({
        title: '密码修改成功',
        icon: 'success'
      })
    }).catch(error => {
      wx.showToast({
        title: error.message || '修改失败',
        icon: 'error'
      })
    }).finally(() => {
      wx.hideLoading()
    })
  },

  /**
   * 设置支付密码
   */
  setPaymentPassword: function() {
    wx.navigateTo({
      url: '/pages/profile/payment-password/payment-password'
    })
  },

  /**
   * 隐私设置
   */
  privacySettings: function() {
    wx.navigateTo({
      url: '/pages/profile/privacy/privacy'
    })
  },

  /**
   * 消息通知设置
   */
  notificationSettings: function() {
    wx.navigateTo({
      url: '/pages/profile/notification/notification'
    })
  },

  /**
   * 语言设置
   */
  languageSettings: function() {
    wx.navigateTo({
      url: '/pages/profile/language/language'
    })
  },

  /**
   * 关于应用
   */
  aboutApp: function() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  /**
   * 去充值
   */
  goToRecharge: function() {
    wx.navigateTo({
      url: '/pages/profile/recharge/recharge'
    })
  },

  /**
   * 保存资料
   */
  saveProfile: function() {
    const { userInfo } = this.data
    
    if (!userInfo.nickname || userInfo.nickname.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'error'
      })
      return
    }
    
    this.setData({ loading: true })
    
    app.request('/api/users/profile', userInfo, 'PUT').then(res => {
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
      
      // 更新原始数据
      this.setData({
        originalUserInfo: JSON.parse(JSON.stringify(userInfo)),
        hasChanges: false
      })
    }).catch(error => {
      wx.showToast({
        title: error.message || '保存失败',
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
      title: '个人资料',
      path: '/pages/profile/profile'
    }
  }
})