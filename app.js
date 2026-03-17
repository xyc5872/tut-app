// tut应用主逻辑

class TutApp {
    constructor() {
        // DOM元素
        this.videoElement = document.getElementById('videoElement');
        this.trajectoryCanvas = document.getElementById('trajectoryCanvas');
        this.anchorPoint = document.getElementById('anchorPoint');
        this.anchorStatus = document.getElementById('anchorStatus');
        this.timerDisplay = document.getElementById('timer');
        this.movementIndicator = document.getElementById('movementIndicator');
        this.loading = document.getElementById('loading');
        this.permissionRequest = document.getElementById('permissionRequest');

        this.cameraContainer = document.querySelector('.camera-container');
        this.recordBtn = document.getElementById('recordBtn');
        this.clearAnchorBtn = document.getElementById('clearAnchorBtn');
        this.settingsBtn = document.getElementById('settingsBtn');

        // 设置相关元素
        this.settingsPanel = document.getElementById('settingsPanel');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.areaSlider = document.getElementById('areaSlider');
        this.areaValue = document.getElementById('areaValue');
        this.colorSelect = document.getElementById('colorSelect');
        this.lineWidthSlider = document.getElementById('lineWidthSlider');
        this.lineWidthValue = document.getElementById('lineWidthValue');

        // 视频预览相关元素
        this.videoPreview = document.getElementById('videoPreview');
        this.previewVideo = document.getElementById('previewVideo');
        this.closePreviewBtn = document.getElementById('closePreviewBtn');
        this.saveVideoBtn = document.getElementById('saveVideoBtn');

        // 状态变量
        this.stream = null;
        this.anchorX = null;
        this.anchorY = null;
        this.isRecording = false;
        this.hasMovement = false;
        this.recordingStartTime = null;
        this.firstMovementTime = null; // 第一次移动时间
        this.tutTime = 0; // tut时间（从第一次移动到停止录制）
        this.trajectoryPoints = [];
        this.trackingPosition = { x: null, y: null }; // 当前追踪位置
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.timerInterval = null;
        this.animationFrame = null;
        this.canvasCtx = this.trajectoryCanvas.getContext('2d');

        // 多点锚点数据结构
        this.anchors = []; // 所有锚点：[{x, y, initialImageData, trackingPosition, isReference}]
        this.mainAnchorIndex = 0; // 主锚点索引

        // 设置参数
        this.settings = {
            sensitivity: 30,  // 移动检测灵敏度 (1-100)
            areaSize: 20,     // 检测区域大小 (5-50)
            color: '#ff3b30', // 轨迹颜色
            lineWidth: 3      // 轨迹宽度
        };

        // 隐藏的canvas用于移动检测
        this.detectionCanvas = document.createElement('canvas');
        this.detectionCtx = this.detectionCanvas.getContext('2d');
        this.initialImageData = null;

        // 混合canvas用于录制（包含相机画面+轨迹）
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCtx = this.compositeCanvas.getContext('2d');

        this.init();
    }

    async init() {
        try {
            // 尝试访问相机
            await this.requestCameraPermission();
        } catch (error) {
            console.error('相机初始化失败:', error);
            this.showPermissionRequest();
        }

        // 绑定事件
        this.bindEvents();

        // 调整canvas大小
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    async requestCameraPermission() {
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.videoElement.srcObject = this.stream;

        // 等待视频加载
        await new Promise((resolve) => {
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                resolve();
            };
        });

        // 隐藏加载提示
        this.loading.style.display = 'none';

        // 初始化检测canvas大小
        this.detectionCanvas.width = 640; // 增加尺寸提高精度
        this.detectionCanvas.height = 480;
    }

    showPermissionRequest() {
        this.loading.style.display = 'none';
        this.permissionRequest.classList.add('active');

        document.getElementById('grantPermissionBtn').addEventListener('click', async () => {
            try {
                await this.requestCameraPermission();
                this.permissionRequest.classList.remove('active');
            } catch (error) {
                alert('无法访问相机，请确保已授权相机权限。');
            }
        });
    }

    bindEvents() {
        // 相机容器点击 - 设置锚点
        this.cameraContainer.addEventListener('click', (e) => this.handleContainerClick(e));

        // 控制按钮
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.clearAnchorBtn.addEventListener('click', () => this.clearAnchor());
        this.settingsBtn.addEventListener('click', () => this.openSettings());

        // 设置面板
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());

        // 设置滑块
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.settings.sensitivity = parseInt(e.target.value);
            this.sensitivityValue.textContent = e.target.value;
        });

        this.areaSlider.addEventListener('input', (e) => {
            this.settings.areaSize = parseInt(e.target.value);
            this.areaValue.textContent = e.target.value;
        });

        this.colorSelect.addEventListener('change', (e) => {
            this.settings.color = e.target.value;
            // 更新锚点颜色
            this.anchorPoint.style.borderColor = this.settings.color;
            this.anchorPoint.style.background = this.settings.color + '33'; // 20% opacity
        });

        this.lineWidthSlider.addEventListener('input', (e) => {
            this.settings.lineWidth = parseInt(e.target.value);
            this.lineWidthValue.textContent = e.target.value;
        });

        // 视频预览
        this.closePreviewBtn.addEventListener('click', () => this.closeVideoPreview());
        this.saveVideoBtn.addEventListener('click', () => this.saveVideo());
    }

    handleContainerClick(e) {
        if (this.isRecording) return;

        // 获取点击位置
        const rect = this.cameraContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // 转换到视频坐标系（不再需要翻转）
        const videoRect = this.videoElement.getBoundingClientRect();
        const scaleX = this.videoElement.videoWidth / videoRect.width;
        const scaleY = this.videoElement.videoHeight / videoRect.height;

        const actualX = x * scaleX;
        const actualY = y * scaleY;

        // 保存主锚点坐标
        this.anchorX = actualX;
        this.anchorY = actualY;
        this.mainAnchorIndex = 0;

        // 初始化追踪位置为锚点位置
        this.trackingPosition = { x: actualX, y: actualY };

        // 更新UI
        this.anchorPoint.style.left = `${x}px`;
        this.anchorPoint.style.top = `${y}px`;
        this.anchorPoint.style.display = 'block';

        // 更新状态
        this.anchorStatus.textContent = '锚点已设置，可开始录制';
        this.anchorStatus.classList.add('active');
        this.clearAnchorBtn.disabled = false;

        // 设置多点锚点（主锚点 + 2个参考锚点）
        this.setupMultiAnchors(actualX, actualY);
    }

    // 设置多点锚点（主锚点 + 参考锚点）
    setupMultiAnchors(mainX, mainY) {
        // 清空之前的锚点数据
        this.anchors = [];

        // 主锚点（用户点击的位置）
        this.anchors.push({
            x: mainX,
            y: mainY,
            trackingPosition: { x: mainX, y: mainY },
            initialImageData: null,
            isReference: false
        });

        // 在主锚点周围设置2个参考锚点
        // 参考锚点1：左上方（距离主锚点约100-150像素）
        const ref1X = Math.max(50, mainX - 120);
        const ref1Y = Math.max(50, mainY - 120);
        this.anchors.push({
            x: ref1X,
            y: ref1Y,
            trackingPosition: { x: ref1X, y: ref1Y },
            initialImageData: null,
            isReference: true
        });

        // 参考锚点2：右下方（距离主锚点约100-150像素）
        const maxWidth = this.videoElement.videoWidth;
        const maxHeight = this.videoElement.videoHeight;
        const ref2X = Math.min(maxWidth - 50, mainX + 120);
        const ref2Y = Math.min(maxHeight - 50, mainY + 120);
        this.anchors.push({
            x: ref2X,
            y: ref2Y,
            trackingPosition: { x: ref2X, y: ref2Y },
            initialImageData: null,
            isReference: true
        });

        // 保存所有锚点的初始图像数据
        this.saveAllAnchorsImageData();

        console.log('已设置3个锚点：1个主锚点 + 2个参考锚点');
    }

    saveAllAnchorsImageData() {
        if (!this.stream || !this.videoElement.videoWidth || this.anchors.length === 0) return;

        // 绘制当前帧到检测canvas
        const scaleX = this.detectionCanvas.width / this.videoElement.videoWidth;
        const scaleY = this.detectionCanvas.height / this.videoElement.videoHeight;

        this.detectionCtx.drawImage(
            this.videoElement,
            0, 0,
            this.detectionCanvas.width,
            this.detectionCanvas.height
        );

        const areaSize = this.settings.areaSize;

        // 为每个锚点保存初始图像数据
        for (let i = 0; i < this.anchors.length; i++) {
            const anchor = this.anchors[i];
            const scaledX = Math.floor(anchor.x * scaleX);
            const scaledY = Math.floor(anchor.y * scaleY);

            // 确保区域在canvas范围内
            const safeX = Math.max(areaSize, Math.min(scaledX, this.detectionCanvas.width - areaSize));
            const safeY = Math.max(areaSize, Math.min(scaledY, this.detectionCanvas.height - areaSize));

            // 获取锚点区域的图像数据
            anchor.initialImageData = this.detectionCtx.getImageData(
                safeX - areaSize,
                safeY - areaSize,
                areaSize * 2,
                areaSize * 2
            );

            // 保存安全的锚点位置
            anchor.x = safeX / scaleX;
            anchor.y = safeY / scaleY;
            anchor.trackingPosition = { x: anchor.x, y: anchor.y };
        }
    }

    // 使用块匹配算法追踪所有锚点的移动
    trackMovement() {
        if (this.anchors.length === 0 || !this.stream) {
            return { position: { x: null, y: null }, hasMoved: false };
        }

        // 绘制当前帧到检测canvas
        const scaleX = this.detectionCanvas.width / this.videoElement.videoWidth;
        const scaleY = this.detectionCanvas.height / this.videoElement.videoHeight;

        this.detectionCtx.drawImage(
            this.videoElement,
            0, 0,
            this.detectionCanvas.width,
            this.detectionCanvas.height
        );

        const areaSize = this.settings.areaSize;
        const searchRadius = 30; // 搜索半径

        // 追踪每个锚点
        for (let i = 0; i < this.anchors.length; i++) {
            const anchor = this.anchors[i];
            if (!anchor.initialImageData) continue;

            // 当前追踪位置在检测canvas上的坐标
            const currentX = Math.floor(anchor.trackingPosition.x * scaleX);
            const currentY = Math.floor(anchor.trackingPosition.y * scaleY);

            let bestX = currentX;
            let bestY = currentY;
            let bestScore = Infinity;

            // 遍历搜索区域
            for (let dx = -searchRadius; dx <= searchRadius; dx += 3) {
                for (let dy = -searchRadius; dy <= searchRadius; dy += 3) {
                    const testX = currentX + dx;
                    const testY = currentY + dy;

                    // 确保在canvas范围内
                    if (testX < areaSize || testX > this.detectionCanvas.width - areaSize ||
                        testY < areaSize || testY > this.detectionCanvas.height - areaSize) {
                        continue;
                    }

                    // 获取候选区域的图像数据
                    const candidateData = this.detectionCtx.getImageData(
                        testX - areaSize,
                        testY - areaSize,
                        areaSize * 2,
                        areaSize * 2
                    );

                    // 计算与初始图像的差异
                    const score = this.calculateDifference(anchor.initialImageData, candidateData);

                    if (score < bestScore) {
                        bestScore = score;
                        bestX = testX;
                        bestY = testY;
                    }
                }
            }

            // 更新追踪位置
            anchor.trackingPosition.x = bestX / scaleX;
            anchor.trackingPosition.y = bestY / scaleY;
        }

        // 判断主锚点是否真正移动（相对位置变化）
        const hasRealMovement = this.checkRealMovement();

        // 更新主追踪位置用于轨迹绘制
        const mainAnchor = this.anchors[this.mainAnchorIndex];
        this.trackingPosition = { ...mainAnchor.trackingPosition };

        return { position: this.trackingPosition, hasMoved: hasRealMovement };
    }

    // 检查主锚点是否真正移动（相对于参考锚点）
    checkRealMovement() {
        if (this.anchors.length < 3) return false;

        const mainAnchor = this.anchors[this.mainAnchorIndex];
        const refAnchor1 = this.anchors[1];
        const refAnchor2 = this.anchors[2];

        // 计算主锚点与参考锚点的初始相对距离
        const initialDist1 = this.calculateDistance(mainAnchor.x, mainAnchor.y, refAnchor1.x, refAnchor1.y);
        const initialDist2 = this.calculateDistance(mainAnchor.x, mainAnchor.y, refAnchor2.x, refAnchor2.y);

        // 计算当前位置的相对距离
        const currentDist1 = this.calculateDistance(
            mainAnchor.trackingPosition.x,
            mainAnchor.trackingPosition.y,
            refAnchor1.trackingPosition.x,
            refAnchor1.trackingPosition.y
        );
        const currentDist2 = this.calculateDistance(
            mainAnchor.trackingPosition.x,
            mainAnchor.trackingPosition.y,
            refAnchor2.trackingPosition.x,
            refAnchor2.trackingPosition.y
        );

        // 计算相对距离变化
        const deltaDist1 = Math.abs(currentDist1 - initialDist1);
        const deltaDist2 = Math.abs(currentDist2 - initialDist2);

        // 根据灵敏度判断是否移动
        const threshold = (100 - this.settings.sensitivity) * 0.3; // 相对移动阈值

        // 如果两个参考锚点的相对距离都显著变化，说明是主锚点真移动
        const hasMoved = deltaDist1 > threshold && deltaDist2 > threshold;

        return hasMoved;
    }

    // 计算两点之间的距离
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    // 计算两个图像数据的差异
    calculateDifference(data1, data2) {
        let totalDiff = 0;
        const length = data1.data.length;

        for (let i = 0; i < length; i += 4) {
            const rDiff = Math.abs(data1.data[i] - data2.data[i]);
            const gDiff = Math.abs(data1.data[i + 1] - data2.data[i + 1]);
            const bDiff = Math.abs(data1.data[i + 2] - data2.data[i + 2]);

            totalDiff += (rDiff + gDiff + bDiff) / 3;
        }

        return totalDiff / (length / 4); // 返回平均差异
    }

    toggleRecording() {
        if (this.anchors.length === 0) {
            alert('请先点击屏幕设置锚点！');
            return;
        }

        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.isRecording = true;
        this.hasMovement = false;
        this.recordingStartTime = null;
        this.firstMovementTime = null;
        this.tutTime = 0;
        this.trajectoryPoints = [];
        this.recordedChunks = [];

        // 重置所有锚点的追踪位置
        for (let i = 0; i < this.anchors.length; i++) {
            this.anchors[i].trackingPosition = { x: this.anchors[i].x, y: this.anchors[i].y };
        }
        this.trackingPosition = { x: this.anchors[this.mainAnchorIndex].x, y: this.anchors[this.mainAnchorIndex].y };

        // 更新UI
        this.recordBtn.textContent = '停止录制';
        this.recordBtn.classList.remove('btn-primary');
        this.recordBtn.classList.add('btn-danger');
        this.anchorStatus.textContent = '录制中...';

        // 清空轨迹canvas
        this.canvasCtx.clearRect(0, 0, this.trajectoryCanvas.width, this.trajectoryCanvas.height);

        // 设置混合canvas大小
        const rect = this.cameraContainer.getBoundingClientRect();
        this.compositeCanvas.width = rect.width;
        this.compositeCanvas.height = rect.height;

        // 开始录制视频 - 录制混合canvas
        const canvasStream = this.compositeCanvas.captureStream(30);
        this.mediaRecorder = new MediaRecorder(canvasStream, {
            mimeType: 'video/webm;codecs=vp9'
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.showVideoPreview();
        };

        this.mediaRecorder.start();

        // 开始检测和绘制循环
        this.detectionLoop();
    }

    stopRecording() {
        this.isRecording = false;

        // 计算tut时间（从第一次移动到停止录制）
        if (this.firstMovementTime) {
            this.tutTime = Date.now() - this.firstMovementTime;
        } else {
            this.tutTime = 0;
        }

        // 停止视频录制
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // 停止计时器
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // 停止动画循环
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // 更新UI
        this.recordBtn.textContent = '开始录制';
        this.recordBtn.classList.remove('btn-danger');
        this.recordBtn.classList.add('btn-primary');
        this.anchorStatus.textContent = this.anchors.length > 0 ? '锚点已设置，可开始录制' : '点击屏幕设置锚点';
        this.timerDisplay.style.display = 'none';
        this.movementIndicator.style.display = 'none';
    }

    detectionLoop() {
        if (!this.isRecording) return;

        // 追踪移动
        const trackingResult = this.trackMovement();
        const hasMovement = trackingResult.hasMoved;
        const position = trackingResult.position;

        if (hasMovement && !this.hasMovement) {
            // 首次检测到移动
            this.hasMovement = true;
            this.firstMovementTime = Date.now();
            this.recordingStartTime = Date.now();

            // 开始计时
            this.timerDisplay.style.display = 'block';
            this.timerInterval = setInterval(() => this.updateTimer(), 1000);

            // 显示移动提示
            this.movementIndicator.style.display = 'block';
            setTimeout(() => {
                this.movementIndicator.style.display = 'none';
            }, 2000);

            this.anchorStatus.textContent = '检测到移动！';
        }

        if (this.hasMovement) {
            // 绘制轨迹
            this.drawTrajectory(position);
        }

        // 绘制混合画面（用于录制）
        this.drawComposite();

        // 继续循环
        this.animationFrame = requestAnimationFrame(() => this.detectionLoop());
    }

    drawTrajectory(position) {
        // 计算轨迹canvas上的坐标（不再需要翻转）
        const videoRect = this.videoElement.getBoundingClientRect();
        const scaleX = videoRect.width / this.videoElement.videoWidth;
        const scaleY = videoRect.height / this.videoElement.videoHeight;

        const canvasX = position.x * scaleX;
        const canvasY = position.y * scaleY;

        // 添加轨迹点
        this.trajectoryPoints.push({ x: canvasX, y: canvasY });

        // 限制轨迹点数量，避免内存问题
        if (this.trajectoryPoints.length > 1000) {
            this.trajectoryPoints.shift();
        }

        // 绘制轨迹
        if (this.trajectoryPoints.length > 1) {
            this.canvasCtx.beginPath();
            this.canvasCtx.strokeStyle = this.settings.color;
            this.canvasCtx.lineWidth = this.settings.lineWidth;
            this.canvasCtx.lineCap = 'round';
            this.canvasCtx.lineJoin = 'round';

            this.canvasCtx.moveTo(this.trajectoryPoints[0].x, this.trajectoryPoints[0].y);
            for (let i = 1; i < this.trajectoryPoints.length; i++) {
                this.canvasCtx.lineTo(this.trajectoryPoints[i].x, this.trajectoryPoints[i].y);
            }

            this.canvasCtx.stroke();

            // 绘制轨迹末端点
            const lastPoint = this.trajectoryPoints[this.trajectoryPoints.length - 1];
            this.canvasCtx.fillStyle = this.settings.color;
            this.canvasCtx.beginPath();
            this.canvasCtx.arc(lastPoint.x, lastPoint.y, this.settings.lineWidth + 2, 0, Math.PI * 2);
            this.canvasCtx.fill();
        }
    }

    // 绘制混合画面（相机+轨迹）用于录制
    drawComposite() {
        const rect = this.cameraContainer.getBoundingClientRect();

        // 清空混合canvas
        this.compositeCtx.clearRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);

        // 绘制相机画面（不翻转，录制真实画面）
        this.compositeCtx.drawImage(
            this.videoElement,
            0, 0,
            this.compositeCanvas.width,
            this.compositeCanvas.height
        );

        // 直接绘制轨迹层（不再需要翻转）
        this.compositeCtx.drawImage(this.trajectoryCanvas, 0, 0);

        // 绘制锚点标记（使用真实坐标）
        if (this.trackingPosition.x !== null && this.trackingPosition.y !== null) {
            const videoRect = this.videoElement.getBoundingClientRect();
            const scaleX = videoRect.width / this.videoElement.videoWidth;
            const scaleY = videoRect.height / this.videoElement.videoHeight;

            const anchorCanvasX = this.trackingPosition.x * scaleX;
            const anchorCanvasY = this.trackingPosition.y * scaleY;

            this.compositeCtx.beginPath();
            this.compositeCtx.strokeStyle = this.settings.color;
            this.compositeCtx.lineWidth = 3;
            this.compositeCtx.arc(anchorCanvasX, anchorCanvasY, 15, 0, Math.PI * 2);
            this.compositeCtx.stroke();

            this.compositeCtx.fillStyle = this.settings.color + '80';
            this.compositeCtx.fill();

            this.compositeCtx.fillStyle = '#ffffff';
            this.compositeCtx.beginPath();
            this.compositeCtx.arc(anchorCanvasX, anchorCanvasY, 5, 0, Math.PI * 2);
            this.compositeCtx.fill();
        }
    }

    updateTimer() {
        if (!this.recordingStartTime) return;

        const elapsed = Date.now() - this.recordingStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        this.timerDisplay.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    showVideoPreview() {
        // 创建视频blob
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        this.previewVideo.src = url;
        this.videoPreview.classList.add('active');

        // 保存blob引用
        this.currentVideoBlob = blob;

        // 显示tut时间
        this.updateTutTimeDisplay();
    }

    updateTutTimeDisplay() {
        const tutTimeDisplay = document.getElementById('tutTimeDisplay');
        const hours = Math.floor(this.tutTime / 3600000);
        const minutes = Math.floor((this.tutTime % 3600000) / 60000);
        const seconds = Math.floor((this.tutTime % 60000) / 1000);

        tutTimeDisplay.textContent = `本次Tut时间：${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    closeVideoPreview() {
        this.videoPreview.classList.remove('active');
        this.previewVideo.src = '';
        URL.revokeObjectURL(this.previewVideo.src);
        this.currentVideoBlob = null;
    }

    saveVideo() {
        if (!this.currentVideoBlob) return;

        const url = URL.createObjectURL(this.currentVideoBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tut_recording_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert('视频已下载！您可以在文件应用中查看。');
    }

    clearAnchor() {
        this.anchorX = null;
        this.anchorY = null;
        this.anchors = []; // 清除所有锚点
        this.initialImageData = null;
        this.trackingPosition = { x: null, y: null };

        // 更新UI
        this.anchorPoint.style.display = 'none';
        this.anchorStatus.textContent = '点击屏幕设置锚点';
        this.anchorStatus.classList.remove('active');
        this.clearAnchorBtn.disabled = true;

        // 清空轨迹
        this.canvasCtx.clearRect(0, 0, this.trajectoryCanvas.width, this.trajectoryCanvas.height);
    }

    openSettings() {
        this.settingsPanel.classList.add('active');
    }

    closeSettings() {
        this.settingsPanel.classList.remove('active');
    }

    resizeCanvas() {
        const rect = this.cameraContainer.getBoundingClientRect();
        this.trajectoryCanvas.width = rect.width;
        this.trajectoryCanvas.height = rect.height;

        // 更新混合canvas大小
        this.compositeCanvas.width = rect.width;
        this.compositeCanvas.height = rect.height;

        // 重绘轨迹
        if (this.trajectoryPoints.length > 0 && this.canvasCtx) {
            this.canvasCtx.strokeStyle = this.settings.color;
            this.canvasCtx.lineWidth = this.settings.lineWidth;
            this.canvasCtx.lineCap = 'round';
            this.canvasCtx.lineJoin = 'round';

            this.canvasCtx.beginPath();
            this.canvasCtx.moveTo(this.trajectoryPoints[0].x, this.trajectoryPoints[0].y);
            for (let i = 1; i < this.trajectoryPoints.length; i++) {
                this.canvasCtx.lineTo(this.trajectoryPoints[i].x, this.trajectoryPoints[i].y);
            }
            this.canvasCtx.stroke();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TutApp();
});

// 注册Service Worker（可选，用于离线支持）
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // 可以在这里注册service worker实现离线功能
        // navigator.serviceWorker.register('/service-worker.js');
    });
}
