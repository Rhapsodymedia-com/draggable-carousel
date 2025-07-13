(function(){
    'use strict';
    require.config({
        paths: {
            CerosSDK: '//sdk.ceros.com/standalone-player-sdk-v5.min'
        }
    });
    require(['CerosSDK'], function (CerosSDK) {
        CerosSDK.findExperience()
            .fail(function (error) {
                console.error(error)
            })
            .done(function (experience) {
                const draggingPlugin = document.getElementById("ceros-draggable-carousel-plugin")
                let mainDocument = document.getElementById('main')
                let pageTop = mainDocument.querySelector("div.page-viewport.top")
                let pageContainer = pageTop.querySelector("div.page-container")
                let pageScroll = pageContainer.querySelector(".page-scroll")
                let proportions = 1

                // CREATING STYLE ELEMENT FOR REQUIRED CLASSES
                let cssStyle = document.createElement('style')
                cssStyle.setAttribute('id', 'carousel-additional-classes')
                cssStyle.setAttribute('type', 'text/css')
                cssStyle.textContent = `
                    .temporary-disabled{ display: none !important; pointer-events: none !important; }
                    .dragging-carousel{ cursor: grab !important }
                    .dragging-carousel:active{ cursor: grabbing !important }
                `
                document.querySelector('head').appendChild(cssStyle)

                // MOBILE CHECKER
                let ua = navigator.userAgent.toLowerCase()
                let isMobile = ua.includes('mobile')===true
                if(cerosContext.previewMode===true && mainDocument.parentElement.classList.contains('-desktop')!=true)
                    isMobile = true
                
                // REMOVE DASHES AND REPLACE THEM WITH UPPERCASE LETTERS
                const removeDashes = title => {
                    let newTitle = title.split('-')
                    for(let w=0; w<newTitle.length; w++){
                        if(w===0)
                            continue
                        const firstLetter = newTitle[w][0]
                        newTitle[w] = newTitle[w].replace(firstLetter, firstLetter.toUpperCase())
                    }
                    return newTitle.join('')
                }

                // DEFINING GLOBAL CAROUSELS VALUES
                let attributesNames = ['drag-intensity', 'effects-intensity', 'effects-duration', 'sliding-indicator', 'snapping-duration']
                const globalProperties = {}
                for(let attributeName of attributesNames){
                    let attr = draggingPlugin.getAttribute(attributeName)
                    if(attr==null)
                        console.warn('missing attribute in Draggable Carousel')
                    let attributeValues = attr.split(',')
                    let attributeValue = (isMobile===true && attributeValues[1]!=undefined) ? attributeValues[1] : attributeValues[0]
                    Object.defineProperty(globalProperties, removeDashes(attributeName), {value: parseFloat(attributeValue)})
                }

                // MISCELLANEOUS VARIABLES
                let onDrags = experience.findLayersByTag("on-drag").layers
                window.carouselsArray = []
                const set = {
                    margins: ['left', 'right'],
                    coordinates: ['left', 'top'],
                    axises: ['x', 'y'],
                    dimensions: ['width', 'height'],
                    directions: ['horizontal', 'vertical']
                }
                const defaultObject = {
                    name: '',
                    intensinity: globalProperties.effectsIntensity,
                    duration: globalProperties.effectsDuration,
                    isProgressive: false
                }

                // MISCELLANEOUS FUNCTIONS
                const addAccessibilityFunctionality = (cta, elementsArr) => {
                    let clickedHotspot = document.getElementById(cta.id)
                    const displays = elementsArr.map(dis => dis.style.display)

                    // WAITING TO FIND NEWLY OPENING POP-UP
                    setTimeout(() => {
                        if(clickedHotspot.focusOn==='empty')
                            return

                        // APPLYING EVENT LISTENERS ON A LOOP THAT HAPPENS ONCE
                        if(clickedHotspot.focusOn==undefined){
                            for(let n=0; n<displays.length; n++){
                                if(elementsArr[n].style.display!=displays[n]){
                                    let hotspotsArray = elementsArr.filter(elementsAr => elementsAr.classList.contains('hotspot')===true)
                                    let insidePopUpHotspots = Array.from(elementsArr[n].querySelectorAll('.hotspot'))
                                    let outsidePopUpHotspots = hotspotsArray.filter(out => insidePopUpHotspots.includes(out)===false)

                                    // DISABLING HOTSPOTS IN A CAROUSEL WHICH ARE OUTSIDE CURRENT VISIBLE POP-UP
                                    const toggleOtherHotspots = (tabNumber=-1) => outsidePopUpHotspots.forEach(outside => outside.tabIndex=tabNumber)
                                    toggleOtherHotspots()
                                    clickedHotspot.addEventListener('click', clickEvent => toggleOtherHotspots())

                                    // ENABLING BACK ALL HOTSPOTS IN A CAROUSEL
                                    if(insidePopUpHotspots.length>0){
                                        clickedHotspot.focusOn = insidePopUpHotspots[0]
                                        let lastHotspot = insidePopUpHotspots[insidePopUpHotspots.length-1]
                                        lastHotspot.addEventListener('click', clickEve => toggleOtherHotspots(0))
                                        lastHotspot.focusOn = clickedHotspot
                                    }
                                    break
                                }
                            }
                        }
                        if(clickedHotspot.focusOn!=undefined){
                            clickedHotspot.focusOn.focus()
                            return
                        }
                        clickedHotspot.focusOn = 'empty'
                    }, 50)
                }
                const updateCanvasProportions = () => {
                    const proportion = pageTop.style.zoom!='' ? pageTop.style.zoom : pageTop.style.transform.split('(')[1].split(',')[0]
                    proportions = parseFloat(proportion)
                }
                const sum = (accumulator, currentVal) => accumulator + currentVal
                const selectTheClosestNumber = (one, two, cur) => (Math.abs(two-cur) < Math.abs(one-cur)) ? two : one
                const getDistance = (elem, prop) => {
                    let firstParent = elem.parentElement
                    let coordinate = 0
                    let tries = 0
                    while(firstParent!=pageScroll || tries>=50){
                        let secondParent = firstParent.parentElement
                        coordinate += parseFloat( window.getComputedStyle(firstParent).getPropertyValue(prop) )
                        firstParent = secondParent
                        tries++
                    }
                    let distance = parseFloat( window.getComputedStyle(elem).getPropertyValue(prop) )
                    if(isNaN(distance)===true)
                        distance = 0
                    return (distance + coordinate)
                }

                // CREATING CARUSELS BLUEPRINT
                class Carousel{
                    constructor(mainElement, cerosObj, hammerObj, setup, deltaTime=0, oldTime=0, isSliding=true, isSnapping=true){
                        this.mainElement = mainElement
                        this.cerosObj = cerosObj
                        this.hammerObj = hammerObj
                        this.setup = setup
                        this.deltaTime = deltaTime
                        this.oldTime = oldTime
                        this.isSliding = isSliding
                        this.isSnapping = isSnapping
                    }

                    switchStates(hotspotChecker){
                        // DISABLING HOTSPOTS DURING DRAGGING
                        let hotspots = Array.from( this.mainElement.querySelectorAll('.hotspot') )
                        for(let hotspotElem of hotspots){
                            if(hotspotChecker===true && hotspotElem.style.display!='none'){
                                hotspotElem.classList.add('temporary-disabled')
                                continue
                            }
                            hotspotElem.classList.remove('temporary-disabled')
                        }

                        // STOPING VIDEOS DURING DRAGGING
                        let videos = Array.from( this.mainElement.querySelectorAll('.video') )
                        for(let videoElem of videos){
                            let video = videoElem.querySelector('video')
                            if(video.autoplay===false){
                                let vid = experience.findComponentById(videoElem.id)
                                vid.stopVideo()
                            }
                        }
                    }

                    cycle(triggerData, currentPos){
                        for(let number=0; number<triggerData.interactivePositions.length; number++){
                            let orderNumber = triggerData.lastTriggeredHotspot!=undefined ? triggerData.interactivePositions.indexOf(triggerData.lastTriggeredHotspot)+1 : number
                            if(currentPos>triggerData.interactivePositions[orderNumber]){
                                triggerData.lastTriggeredHotspot = triggerData.interactivePositions[orderNumber]
                                triggerData.interactiveHotspots[1].click()
                                break
                            }
                            else if(triggerData.lastTriggeredHotspot[ax]!=undefined && currentPos<triggerData.lastTriggeredHotspot){
                                let orderNum = this.setup.triggerPositions.indexOf(triggerData.lastTriggeredHotspot)-1
                                triggerData.lastTriggeredHotspot = orderNum>=0 ? triggerData.interactivePositions[orderNum] : null
                                triggerData.interactiveHotspots[0].click()
                                break
                            }
                        }
                    }

                    showTarget(triggerDat, currentP){
                        for(let num=0; num<triggerDat.interactivePositions.length; num++){
                            if(currentP>triggerDat.interactivePositions[num] && triggerDat.interactiveHotspots[num].called!=true){
                                triggerDat.interactiveHotspots[num].called = true
                                triggerDat.interactiveHotspots[num].click()
                                break
                            }
                            else if(currentP<triggerDat.interactivePositions[num] && triggerDat.interactiveHotspots[num].called===true){
                                triggerDat.interactiveHotspots[num].called = false
                                triggerDat.interactiveHotspots[num-1].click()
                                break
                            }
                        }
                    }

                    updateChildrenStyling(direction=0, isDragged=false){
                        let triggerHotspots = []
                        let snapPoints = [...new Array(set.coordinates.length)].map(array => [])

                        // GATHERING ALL OBJECTS RELATED TO A CAROUSEL (INSIDE AND OUTSIDE A CAROUSEL)
                        let carouselLayers = this.cerosObj.findAllComponents().layers
                        if(this.allLayers==undefined){
                            let connectedLayers = experience.findLayersByTag(`carousel:${this.setup.idNumber}`).layers
                            connectedLayers = connectedLayers.filter(comp => experience.findLayerById(comp.id).tags.includes('on-drag')!=true)
                            this.allLayers ??= [carouselLayers, connectedLayers].flat()
                        }
                        
                        // GOING THROUGH EVERY CEROS OBJECT RELATED TO A CAROUSEL
                        for(let layer of this.allLayers){
                            let element = document.getElementById(layer.id)
                            let initialStates = {}

                            // GOING THROUGH EVERY TAG OF A CEROS OBJECT
                            let strings = layer.tags
                            for(let string of strings){
                                
                                // DEFINING SNAPPING FUNCTIONALITY
                                if(string.includes('snap-area')===true && this.setup.snapPositions==undefined){
                                    for(let s=0; s<set.coordinates.length; s++){
                                        const viewSpace = Object.values(this.setup.viewport)[s]
                                        const startPoint = parseFloat(element.style.getPropertyValue(set.coordinates[s]))
                                        const centerPoint = parseFloat(element.style.getPropertyValue(set.dimensions[s]))/2
                                        let snapPoint = viewSpace/2 - (startPoint + centerPoint)
                                        let coord = parseFloat(this.mainElement.style.getPropertyValue(set.coordinates[s]))
                                        snapPoint = Math.min(snapPoint, coord)
                                        snapPoint = Math.max(snapPoint, this.setup.range[set.dimensions[s]]+coord)
                                        snapPoints[s].push(snapPoint)
                                    }
                                }

                                // DEFINING TRIGGERING HOTSPOTS FUNCTIONALITY
                                if(this.setup.triggerDatas.isUpdated===false){
                                    if(string.includes('triggers')===true && (layer.isGroup() || layer.isFolder())){
                                        let hots = layer.items.filter(item => item.type==='hotspot')
                                        hots = hots.map(it => experience.findLayerById(it.id))
                                        let isHorizontal = this.setup.directionAxis!=set.directions[1] && (layer.payload==='' || layer.payload==set.directions[0])
                                        hots.forEach(hot => hot.orientation = isHorizontal===true ? set.axises[0] : set.axises[1])
                                        triggerHotspots.push(hots)
                                    }
                                }

                                if(string.includes('-effect')===false)
                                    continue

                                // GETTING PROPER NAMING CONVENTION
                                let childEffect = string.split('-effect')
                                let effectName = childEffect[0]
                                let effectParameters = this.setup.effects.find(e => e.name==effectName) ?? defaultObject
                                effectParameters = Object.assign(new Object(), effectParameters)
                                effectParameters.name = effectName
                                if(childEffect[1]!=''){
                                    let effectPara = childEffect[1].replaceAll(':','').split(',')
                                    let floatValues = effectPara.filter(vv => isNaN( parseFloat(vv) )===false)
                                    effectParameters.intensinity = floatValues[0] ?? effectParameters.intensinity
                                    effectParameters.duration = floatValues[1] ?? effectParameters.duration
                                    effectParameters.isProgressive = effectPara.includes('progressive')===true
                                }
                                effectName = removeDashes(effectName)

                                // DEFINING PROGRESS OF DRAGGING THROUGH A CAROUSEL
                                let availableRanges = Object.values(this.setup.range)
                                let progressRanges = new Array(availableRanges.length)
                                for(let q=0; q<progressRanges.length; q++){
                                    progressRanges[q] = this.mainElement.style.transform.split('(')[1].split('px,')[q]
                                    progressRanges[q] = parseFloat(progressRanges[q]) / this.setup.range[Object.keys(this.setup.range)[q]]
                                    progressRanges[q] = isNaN(progressRanges[q])===true ? 0 : progressRanges[q]
                                    if(availableRanges[q]==0 || (this.setup.directionAxis!=set.directions[q] && this.setup.isFreeMovementActive===false))
                                        availableRanges.shift()
                                }

                                let progressRange = 1
                                if(effectParameters.isProgressive===true){
                                    progressRange = progressRanges.reduce(sum) / availableRanges.length
                                    progressRange = isNaN(progressRange)===true ? 0 : progressRange
                                    direction = 1
                                }

                                // DEFINING DEFAULT VALUES FOR CHILDREN PROPERTIES WHEN A DRAGGING ISN'T HAPPENING
                                if(layer.idleStates==undefined){
                                    let initialValue = effectParameters.isProgressive===true ? 0 : 1

                                    let comma = ', '
                                    if(element.style.getPropertyValue('transition-property')==='none'){
                                        comma = ''
                                        element.style.setProperty('transition-property', comma)
                                        element.style.setProperty('transition-duration', comma)
                                    }
                                    if(effectName==='rotate' || effectName==='skewX' || effectName==='skewY'){
                                        initialValue = '0deg'
                                        element.style.transitionProperty += `${comma}transform`
                                        element.style.transitionDuration += `${comma}${effectParameters.duration}ms`
                                    }
                                    if(effectName==='scale' || effectName==='opacity'){
                                        element.style.transitionProperty += `${comma}${effectName}`
                                        element.style.transitionDuration += `${comma}${effectParameters.duration}ms`
                                    }
                                    if(effectName==='blur' || effectName==='width' || effectName==='height'){
                                        if(effectName==='blur'){
                                            initialValue = '0px'
                                            element.style.transitionProperty += `${comma}filter`
                                        }
                                        if(effectName==='width' || effectName==='height'){
                                            initialValue = element.style.getPropertyValue(effectName)
                                            element.style.transitionProperty += `${comma}${effectName}`
                                        }
                                        element.style.transitionDuration += `${comma}${effectParameters.duration}ms`
                                    }

                                    initialStates[effectName] ??= initialValue
                                }
                                
                                // SETTING PROPERTIES VALUES
                                let check = (isDragged===true || effectParameters.isProgressive===true)
                                let idleState = layer.idleStates!=undefined ? layer.idleStates[effectName] : initialStates[effectName]
                                switch(effectName){
                                    case 'width':
                                    case 'height':
                                        let len = check ? `${effectParameters.intensinity*progressRange*parseFloat(idleState)}px` : idleState
                                        element.style.setProperty(effectName, len)
                                        break
                                    case 'rotate':
                                    case 'skewX':
                                    case 'skewY':
                                        let tra = check ? `${effectParameters.intensinity*progressRange*direction+parseFloat(idleState)}deg` : idleState
                                        element.style.setProperty('transform', `${effectName}(${tra})`)
                                        break
                                    case 'scale':
                                    case 'opacity':
                                        let sca = check ? `${effectParameters.intensinity*progressRange}` : idleState
                                        element.style.setProperty(effectName, sca)
                                        break
                                    default:
                                        let fil = check ? `${effectParameters.intensinity*progressRange}px` : idleState
                                        element.style.setProperty('filter', `${effectName}(${fil})`)
                                }
                            }
                            layer.idleStates ??= initialStates
                        }
                        this.setup.snapPositions ??= snapPoints

                        if(this.setup.triggerDatas.isUpdated===false){
                            triggerHotspots = triggerHotspots.flat()
                            for(let currentAxis of set.axises){
                                let triggerPoints = carouselLayers.filter(trigg => trigg.tags.includes('trigger-point'))
                                triggerPoints.unshift(this.setup.startingPoint[currentAxis])
                                this.setup.triggerDatas[currentAxis] = {
                                    interactivePositions: triggerPoints.map(trig => trig[currentAxis]),
                                    interactiveHotspots: triggerHotspots.filter(triggerHot => triggerHot.orientation==currentAxis),
                                    lastTriggeredHotspot: null
                                }
                            }
                            this.setup.triggerDatas.isUpdated = true
                        }
                        else{
                            for(let axisName of set.axises){
                                if(this.setup.triggerDatas[axisName].interactiveHotspots.length===0)
                                    continue
                                const currentData = this.setup.triggerDatas[axisName]
                                const currentPosition = this.setup.dragMovement.currentValue[axisName] * -1
                                if(currentData.interactiveHotspots.length===2)
                                    this.cycle(currentData, currentPosition)
                                if(currentData.interactiveHotspots.length==currentData.interactivePositions.length)
                                    this.showTarget(currentData, currentPosition)
                            }
                        }
                    }

                    updateOnDragging(multi=1){
                        updateCanvasProportions()
                        
                        let power = this.setup.dragStrength * multi
                        let currentValues = Object.keys(this.setup.dragMovement.currentValue)
                        for(let j=0; j<currentValues.length; j++){
                            const axi = set.axises[j]
                            const dim = set.dimensions[j]
                            const newValue = (this.setup.dragMovement.deltaValue[axi]/proportions)*power + this.setup.dragMovement.oldValue[axi]

                            // UNABLING MOVEMENT FOR DISABLED AXIS
                            if(this.setup.directionAxis!=set.directions[j] && this.setup.isFreeMovementActive===false){
                                this.setup.dragMovement.currentValue[axi] = 0
                                continue
                            }
                            // UPDATING MOVEMENT POSITION
                            if((newValue <= this.setup.startingPoint[axi]) && (newValue >= this.setup.range[dim]+this.setup.startingPoint[axi])){
                                this.setup.dragMovement.currentValue[axi] = newValue
                                continue
                            }
                            // STICKING TO MINIMUM RANGE OF A CAROUSEL
                            if(newValue > this.setup.startingPoint[axi]){
                                this.setup.dragMovement.currentValue[axi] = this.setup.startingPoint[axi]
                                continue
                            }
                            // STICKING TO MAXIMUM RANGE OF A CAROUSEL
                            this.setup.dragMovement.currentValue[axi] = this.setup.range[dim]+this.setup.startingPoint[axi]
                        }
                        this.mainElement.style.transform = `translate3d(${this.setup.dragMovement.currentValue.x}px, ${this.setup.dragMovement.currentValue.y}px, 0px)`
                    }

                    updateTime(){
                        const currentTime = Date.now()
                        this.deltaTime = currentTime - this.oldTime
                        this.oldTime = currentTime
                    }

                    updateScreenViewOnTab = keyEvent => {
                        if(keyEvent.code==='Tab'){
                            updateCanvasProportions()
                            pageScroll.style.position = 'static'
                            requestAnimationFrame(() => {
                                let hotspotsElements = Array.from(this.mainElement.querySelectorAll('.hotspot'))
                                for(let hotspotElement of hotspotsElements){
                                    if(hotspotElement==document.activeElement){
                                        for(let k=0; k<set.axises.length; k++){
                                            let oppositeValue = k===0 ? set.dimensions[1] : set.dimensions[0]
                                            if(this.setup.directionAxis==set.directions[k] || this.setup.range[oppositeValue]===0){
                                                let newVal = getDistance(hotspotElement, set.coordinates[k])
                                                this.setup.dragMovement.currentValue[set.axises[k]] = Math.max(-newVal, this.setup.range[set.dimensions[k]])
                                            }
                                        }
                                        this.mainElement.style.transform = `translate3d(${this.setup.dragMovement.currentValue.x}px, ${this.setup.dragMovement.currentValue.y}px, 0px)`
                                        this.refreshOldValue()
                                    }
                                }
                                pageScroll.style.position = 'absolute'
                            })
                        }
                    }

                    updateOnDragStart(){
                        let lastValue = 0
                        let newDirection = 1

                        this.hammerObj.on('press panmove', event => {
                            newDirection = 0
                            if(lastValue > event.deltaX)
                                newDirection = 1
                            if(lastValue < event.deltaX)
                                newDirection = -1

                            lastValue = event.deltaX
                            this.setup.dragMovement.deltaValue.x = event.deltaX
                            this.setup.dragMovement.deltaValue.y = event.deltaY
                            
                            this.isSliding = false
                            this.isSnapping = false
                            this.updateTime()
                            this.updateOnDragging()
                            this.switchStates(true)
                            this.updateChildrenStyling(newDirection, true)
                        })

                        window.addEventListener('keydown', this.updateScreenViewOnTab)
                        this.updateChildrenStyling(newDirection, false)
                    }

                    refreshOldValue(){
                        for(let axis of set.axises)
                            this.setup.dragMovement.oldValue[axis] = this.setup.dragMovement.currentValue[axis]
                    }

                    animateSnapping(interpolation, snapValues){
                        if(this.isSnapping===false)
                            return

                        this.updateTime()
                        interpolation += this.deltaTime
                        for(let m=0; m<set.axises.length; m++){
                            if(this.setup.snapPositions[m].length>0){
                                let curr = this.setup.dragMovement.currentValue[set.axises[m]]
                                let snapValue = this.setup.snapPositions[m].reduce((first, second) => selectTheClosestNumber(first, second, curr))
                                let lerpValue = Math.sin(interpolation/globalProperties.snappingDuration * Math.PI/2)
                                snapValues[m] = this.setup.dragMovement.currentValue[set.axises[m]] + (snapValue - this.setup.dragMovement.currentValue[set.axises[m]]) * lerpValue
                                this.setup.dragMovement.currentValue[set.axises[m]] = Math.min(snapValues[m], -this.setup.range[set.dimensions[m]])
                            }
                        }
                        this.mainElement.style.transform = `translate3d(${this.setup.dragMovement.currentValue.x}px, ${this.setup.dragMovement.currentValue.y}px, 0px)`
                        this.refreshOldValue()
                        this.updateChildrenStyling()

                        if(interpolation<globalProperties.snappingDuration)
                            requestAnimationFrame(() => this.animateSnapping(interpolation, snapValues))
                    }

                    snapToPosition(checker=true){
                        if(this.setup.snapPositions==undefined || checker===false)
                            return

                        let interpolationValue = 0
                        let allSnapValues = [0,0]
                        this.isSnapping = true
                        this.animateSnapping(interpolationValue, allSnapValues)
                    }

                    animateSliding(newTime, velocityValue){
                        if(this.isSliding===false)
                            return
                        
                        this.updateTime()
                        newTime += this.deltaTime

                        let multiplier = Math.min(newTime, this.setup.slideIndicator) / this.setup.slideIndicator
                        multiplier = Math.sin(Math.PI*multiplier / 2)
                        multiplier = velocityValue * (1-multiplier)

                        this.snapToPosition(multiplier==0)
                        this.updateOnDragging(multiplier)
                        this.refreshOldValue()
                        this.updateChildrenStyling()

                        if(multiplier>0)
                            requestAnimationFrame(() => this.animateSliding(newTime, velocityValue))
                    }

                    updateOnDragEnd(){
                        let velocityType = 'velocity'
                        for(let v=0; v<set.directions.length; v++){
                            let oppositeRange = v===0 ? set.dimensions[1] : set.dimensions[0]
                            if(this.setup.directionAxis==set.directions[v] || this.setup.range[oppositeRange]===0){
                                velocityType = `${velocityType}${set.axises[v].toUpperCase()}`
                                break
                            }
                        }

                        this.hammerObj.on('pressup panend pancancel', eve => {
                            this.refreshOldValue()

                            this.isSliding = this.setup.slideIndicator!=0
                            let vel = Math.abs(eve[velocityType] / Math.sqrt(this.setup.slideIndicator))
                            this.animateSliding(0, vel)
                            this.snapToPosition(this.isSliding===false)
                            this.switchStates(false)
                            this.updateChildrenStyling()
                        })
                        this.hammerObj.on('tap', ev => this.switchStates(false))
                    }
                }

                const pageChangedCallback = pag => {
                    pageTop = document.querySelector("div.page-viewport.top")
                    pageContainer = pageTop.querySelector("div.page-container")
                    pageScroll = pageContainer.querySelector(".page-scroll")
                    const pageWidth = parseFloat(pageScroll.style.width)
                    updateCanvasProportions()

                    // GOING THROUGH EVERY DRAGGABLE CAROUSEL OBJECT THAT ARE ON CURRENT PAGE
                    let draggableCarousels = onDrags.filter(dra => pageContainer.contains( document.getElementById(dra.id) )===true)
                    console.log(draggableCarousels)
                    if(draggableCarousels.some(caro => caro.isDraggable!=undefined)===true)
                        return
                    for(let i=0; i<draggableCarousels.length; i++){

                        // FINDING DRAGGABLE CAROUSEL ELEMENT AND CEROS OBJECT TAGS
                        draggableCarousels[i].isDraggable ??= true
                        let draggableCarousel = document.getElementById(draggableCarousels[i].id)
                        let allTags = draggableCarousels[i].tags

                        // FINDING "EMPTY-SHAPE"
                        let draggableCarouselChildren = draggableCarousels[i].items
                        let emptyShape = draggableCarouselChildren.find(lay => lay.tags.includes('empty-shape'))
                        if(emptyShape==undefined){
                            console.warn(`"empty-shape" component is missing for Draggable Carousel with id "${draggableCarousel.id}"`)
                            continue
                        }
                        console.log(emptyShape)
                        
                        // DEFINING CAROUSEL AREA
                        for(let dimensionName of set.dimensions)
                            draggableCarousel.style[dimensionName] = emptyShape[dimensionName]!=undefined ? `${emptyShape[dimensionName]}px` : '0px'

                        // DEFINING STARTING POINT OF A CAROUSEL
                        let startingCoordinates = []
                        for(let coordinateName of set.coordinates){
                            let startingCoordinate = parseFloat( draggableCarousel.style.getPropertyValue(set.coordinates[coordinateName]) )
                            startingCoordinate = isNaN(startingCoordinate)===false ? Math.abs( Math.min(startingCoordinate, 0) ) : 0
                            startingCoordinates.push(startingCoordinate)
                        }
                        console.log(startingCoordinates)

                        // GRANTING ACCESSIBLITY FEATURE
                        if(cerosContext.featureFlags.Accessibility===true){
                            let objectsArray = draggableCarousels[i].findAllComponents().layers
                            let elementsArray = objectsArray.map(oo => document.getElementById(oo.id))
                            let hotspotsObjects = objectsArray.filter(hh => hh.type==='hotspot')

                            for(let hotspotObject of hotspotsObjects)
                                hotspotObject.on(CerosSDK.EVENTS.CLICKED, hotspotObj => addAccessibilityFunctionality(hotspotObj, elementsArray))
                        }

                        // DEFINING CAROUSEL HORIZONTAL MARGINS
                        let extraSpace = 0
                        for(let marginName of set.margins){
                            let margin = getDistance(draggableCarousel, marginName)
                            margin = Math.max(Math.round(margin), 0)
                            extraSpace += margin
                        }
                        console.log(extraSpace)

                        // GETTING MASK VALUES FROM PARENT ELEMENT
                        let viewHeight = cerosContext.docVersion.viewportHeight
                        let dataContainerId = draggableCarousel.getAttribute('data-container-id')
                        let parentObject = experience.findLayerById(dataContainerId)
                        let parentElem = document.getElementById(dataContainerId)
                        if(parentElem==null){
                            parentElem = document.createElement('div')
                            draggableCarousel.parentElement.prepend(parentElem)
                            parentElem.append(draggableCarousel)
                        }
                        if(parentObject!=null && parentObject.tags.includes('masking')===true){
                            let mask = parentObject.payload.split(',')
                            if(mask.length<2)
                                mask = [emptyShape.width, emptyShape.height]
                            if(mask.length<4)
                                mask.push(0,0)

                            // SETTING VISIBLE AREA FOR CAROUSEL GROUP IN WHICH IT WILL MOVE
                            if(parentElem.classList.contains('page-scroll')===false){
                                viewHeight = mask[1]
                                parentElem.style.width = `${mask[0]}px`
                                parentElem.style.height = `${mask[1]}px`
                                parentElem.style.left = `${mask[2]}px`
                                parentElem.style.top = `${mask[3]}px`
                                parentElem.style.position = 'absolute'
                                parentElem.style.overflow = 'hidden'
                                parentElem.classList.add('carousel-parent')
                            }
                        }
                        console.log('works')
                        
                        // TURNING OFF "DRAGGABLE" ON IMG ELEMENTS
                        let images = Array.from( draggableCarousel.querySelectorAll('img') )
                        for(let image of images)
                            image.setAttribute('draggable', false)

                        // SETTING DEFAULT EFFECTS VALUES FOR PROPERTIES
                        let payloadValues = draggableCarousels[i].payload.split(',')
                        let localEffectsIntensity = payloadValues!='' ? payloadValues[0] : globalProperties.effectsIntensity
                        let localEffectsDuration = payloadValues[1] ?? globalProperties.effectsDuration
                        console.log(payloadValues)

                        // SETTING PROPERTIES FROM TAGS
                        const createEffectObject = ef => {
                            let numberValues = ef.filter(vv => isNaN( parseFloat(vv) )===false)
                            let obj = {
                                name: ef[0] ?? 'effect name is missing',
                                intensinity: numberValues[0] ?? localEffectsIntensity,
                                duration: numberValues[1] ?? localEffectsDuration,
                                isProgressive: ef.includes('progressive')===true
                            }
                            return obj
                        }
                        const getEffects = tagNam => {
                            let dragEffects = allTags.filter(tag => tag.includes(tagNam))
                            dragEffects = dragEffects.map(dragEffect => dragEffect.slice(tagNam.length, dragEffect.length).split(','))
                            return dragEffects.map(eff => createEffectObject(eff, localEffectsIntensity, localEffectsDuration))
                        }
                        const definePropertyValue = (tagName, defaultValue, isNumber=true) => {
                            let pro = allTags.find(nam => nam.includes(tagName))
                            let val = (pro!=undefined && pro.slice(tagName.length)!='') ? pro.slice(tagName.length) : defaultValue
                            if(isNumber===true)
                                val = parseFloat(val)
                            return val
                        }
                        const settings = {
                            effects: getEffects('drag-effect:'),
                            dragStrength: definePropertyValue('drag-intensity:', globalProperties.dragIntensity),
                            slideIndicator: definePropertyValue('sliding-indicator:', globalProperties.slidingIndicator),
                            directionAxis: definePropertyValue('direction-axis:', 'all', false),
                            idNumber: definePropertyValue('carousel:', null),
                            startingPoint: {
                                x: startingCoordinates[0],
                                y: startingCoordinates[1]
                            },
                            dragMovement: {
                                oldValue: {x:0, y:0},
                                currentValue: {x:0, y:0},
                                deltaValue: {x:0, y:0}
                            },
                            range: {
                                width: pageWidth - Math.max(emptyShape.width, pageWidth) - extraSpace,
                                height: Math.min(viewHeight - emptyShape.height, 0)
                            },
                            triggerDatas: {
                                x: null,
                                y: null,
                                isUpdated: false
                            },
                            viewport: {
                                width: cerosContext.docVersion.viewportWidth,
                                height: viewHeight
                            }
                        }
                        
                        // STYLING CAROUSEL ELEMENT
                        draggableCarousel.classList.add('dragging-carousel')

                        // HAMMER.JS
                        const hammerObject = new Hammer(draggableCarousel)
                        hammerObject.get('press').set({ time: 101 })
                        settings.isFreeMovementActive = settings.directionAxis==='both' || settings.directionAxis==='all'
                        const dir = settings.isFreeMovementActive===true ? 'all' : settings.directionAxis
                        hammerObject.get('pan').set({ direction: Hammer[`DIRECTION_${dir.toUpperCase()}`], threshold: 1 })
                        hammerObject.get('pinch').set({ enable: false })
                        hammerObject.get('rotate').set({ enable: false })
                        hammerObject.get('swipe').set({ enable: false })
                        hammerObject.get('tap').set({ enable: false })
                        hammerObject.get('doubletap').set({ enable: false })

                        // INITIALIZING CAROUSEL FUNCTIONALITY
                        carouselsArray[i] = new Carousel(draggableCarousel, draggableCarousels[i], hammerObject, settings)
                        carouselsArray[i].updateOnDragStart()
                        carouselsArray[i].updateOnDragEnd()
                    }
                }
                experience.on(CerosSDK.EVENTS.PAGE_CHANGED, pageChangedCallback)
            })
    });
})();
