let allHidden = false;
let hideTimeoutId;

var resetTimeout = function () {
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId)
      hideTimeoutId = null;
    }
}

function rollupStateManager(options) {
    var { windowName, bodyID, headerID, containerID, hideCallback, containerHeightTarget, bodyHeightTarget } = options
    let isRolledup = false;

    var updateRollup = function(hidden) {

       var trackerBody = $(bodyID);
       var trackerHeaders = $(headerID);
       var container = $(containerID);

       if (hidden) {
         if(!isRolledup) {
           trackerBody.animate({
               height: "0px"
             }, {
               duration: 200,
               queue: false,
               complete: function() {
                 trackerBody[0].style.visibility = "hidden";
                 isRolledup = true;
                 trackerBody.css({display: "none"});
                 hideCallback(true);
               }
             }
           );

           container.animate({height: trackerHeaders[0].scrollHeight + "px"}, {duration: 200, queue: false});
         }
       } else {
         if(isRolledup) {
           trackerBody[0].style.height = "0px";
           trackerBody[0].style.visibility = "visible";
           trackerBody.css({display: "inherit"});
           let targetHeight = bodyHeightTarget !== undefined ? bodyHeightTarget : trackerBody[0].scrollHeight + "px";
           console.log("body height " + targetHeight)
           trackerBody.animate({height: targetHeight},
             {duration: 200, queue: false, complete:
               function() {
                 trackerBody[0].style.visibility = "visible";
                 isRolledup = false;
                 hideCallback(false)
               }
             }
           );
           let currentHeight = container[0].height;
           targetHeight = containerHeightTarget !== undefined ? containerHeightTarget : container[0].style.height;
           console.log("container height " + targetHeight)
           container[0].style.height = currentHeight;
           container.animate({height: targetHeight}, {duration: 200, queue: false, complete: hideCallback});
         }
         resetTimeout();
       }
    }
  return {updateRollup: updateRollup}
}

function hideWindowManager(options) {
    let { windowName, useRollupMode, getHideDelay, getInverted, containerID, bodyID, headerID, hideCallback,
          containerHeightTarget, bodyHeightTarget} = options

    let rollupManager = rollupStateManager({
      windowName: windowName,
      bodyID: bodyID,
      headerID: headerID,
      containerID: containerID,
      hideCallback: hideCallback,
      containerHeightTarget: containerHeightTarget,
      bodyHeightTarget: bodyHeightTarget,
    })

    var updateOpacity = function() {
        if (allHidden) {
            document.getElementById("container").style.opacity = "0.1";
        } else {
            document.getElementById("container").style.opacity = "1";
            resetTimeout();
        }
    }

    var updateVisibility = function (hidden) {
        if(useRollupMode()) {
          rollupManager.updateRollup(hidden);
        } else {
          updateOpacity();
        }
    }

    var toggleHidden = function(hide) {
        if (hide === undefined || hide === null) {
          allHidden = !allHidden;
        } else {
          allHidden = hide;
        }
        console.log(`toggle hidden called ${hide} / ${allHidden}`)
        updateVisibility(allHidden);
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId)
            hideTimeoutId = null;
        }
        if (getHideDelay() < 100) {
          hideTimeoutId = setTimeout(function() {
              allHidden = getInverted();
              updateVisibility(allHidden)
          }, 1000 * getHideDelay())
        }
    }
    return {toggleHidden: toggleHidden}
}

module.exports = hideWindowManager