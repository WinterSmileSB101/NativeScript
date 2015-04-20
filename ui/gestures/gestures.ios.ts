﻿import common = require("ui/gestures/gestures-common");
import definition = require("ui/gestures");
import view = require("ui/core/view");

//var OWNER = "_owner";
//var CALLBACK = "_callback";
//var TYPE = "_type";
//var TARGET = "_target";

// merge the exports of the request file with the exports of this file
declare var exports;
require("utils/module-merge").merge(common, exports);

class UIGestureRecognizerImpl extends NSObject {
    static new(): UIGestureRecognizerImpl {
        return <UIGestureRecognizerImpl>super.new();
    }

    private _owner: GesturesObserver;
    private _type: any;
    private _callback: Function;

    public initWithOwnerTypeCallback(owner: GesturesObserver, type: any, callback?: Function): UIGestureRecognizerImpl {
        this._owner = owner;
        this._type = type;
        if (callback) {
            this._callback = callback;
        }

        return this;
    }

    public static ObjCExposedMethods = {
        "recognize": { returns: interop.types.void, params: [UIGestureRecognizer] }
    };

    public recognize(recognizer: UIGestureRecognizer): void {
        var callback = this._callback ? this._callback : this._owner._callback;
        var type = this._type;
        var target = this._owner._target;

        var args = {
            type: type,
            view: target,
            ios: recognizer,
            android: undefined
        };

        if (callback) {
            callback(args);
        }
    }
}

export class GesturesObserver implements definition.GesturesObserver {
    public _callback: (args: definition.GestureEventData) => void;
    public _target: view.View;
    private _recognizers: {};

    constructor(callback: (args: definition.GestureEventData) => void) {
        this._callback = callback;
        this._recognizers = {};
    }

    public observe(target: view.View, type: definition.GestureTypes) {
        this.disconnect();

        this._target = target;

        if (this._target && this._target.ios && this._target.ios.addGestureRecognizer) {
            var nativeView = <UIView>this._target.ios;

            if (type & definition.GestureTypes.tap) {
                nativeView.addGestureRecognizer(this._createRecognizer(definition.GestureTypes.tap));
            }

            if (type & definition.GestureTypes.doubleTap) {
                var r = <UITapGestureRecognizer>this._createRecognizer(definition.GestureTypes.doubleTap);
                r.numberOfTapsRequired = 2;

                nativeView.addGestureRecognizer(r);
            }

            if (type & definition.GestureTypes.pinch) {
                nativeView.addGestureRecognizer(this._createRecognizer(definition.GestureTypes.pinch, args => {
                    this._executeCallback(_getPinchData(args));
                }));
            }

            if (type & definition.GestureTypes.pan) {
                nativeView.addGestureRecognizer(this._createRecognizer(definition.GestureTypes.pan, args => {
                    this._executeCallback(_getPanData(args, this._target.ios));
                }));
            }

            if (type & definition.GestureTypes.swipe) {
                nativeView.addGestureRecognizer(this._createRecognizer(definition.GestureTypes.swipe, args => {
                    this._executeCallback(_getSwipeData(args));
                }));
            }

            if (type & definition.GestureTypes.rotation) {
                nativeView.addGestureRecognizer(this._createRecognizer(definition.GestureTypes.rotation, args => {
                    this._executeCallback(_getRotationData(args));
                }));
            }

            if (type & definition.GestureTypes.longPress) {
                nativeView.addGestureRecognizer(this._createRecognizer(definition.GestureTypes.longPress));
            }
        }
    }

    public disconnect() {
        if (this._target && this._target.ios) {

            for (var name in this._recognizers) {
                if (this._recognizers.hasOwnProperty(name)) {
                    var item = <RecognizerCache>this._recognizers[name];
                    this._target.ios.removeGestureRecognizer(item.recognizer);

                    item.recognizer = null;
                    item.target = null;
                }
            }

            this._recognizers = {};
        }

        this._target = null;
    }

    private _executeCallback(args: definition.GestureEventData) {
        if (this._callback) {
            this._callback(args);
        }
    }

    private _createRecognizer(type: definition.GestureTypes, callback?: (args: definition.GestureEventData) => void): UIGestureRecognizer {
        var recognizer: UIGestureRecognizer;
        var name = definition.toString(type);
        var target = _createUIGestureRecognizerTarget(this, type, callback);
        var recognizerType = _getUIGestureRecognizerType(type);

        if (recognizerType) {
            recognizer = recognizerType.alloc().initWithTargetAction(target, "recognize");
            if (recognizer) {
                this._recognizers[name] = <RecognizerCache>{ recognizer: recognizer, target: target };
            }
        }

        return recognizer;
    }
}

function _createUIGestureRecognizerTarget(owner: GesturesObserver, type: definition.GestureTypes, callback?: (args: definition.GestureEventData) => void): any {
    return UIGestureRecognizerImpl.new().initWithOwnerTypeCallback(owner, type, callback);
}

interface RecognizerCache {
    recognizer: UIGestureRecognizer;
    target: any;
}

function _getUIGestureRecognizerType(type: definition.GestureTypes): any {
    var nativeType = null;

    if (type === definition.GestureTypes.tap) {
        nativeType = UITapGestureRecognizer;
    } else if (type === definition.GestureTypes.doubleTap) {
        nativeType = UITapGestureRecognizer;
    } else if (type === definition.GestureTypes.pinch) {
        nativeType = UIPinchGestureRecognizer;
    } else if (type === definition.GestureTypes.pan) {
        nativeType = UIPanGestureRecognizer;
    } else if (type === definition.GestureTypes.swipe) {
        nativeType = UISwipeGestureRecognizer;
    } else if (type === definition.GestureTypes.rotation) {
        nativeType = UIRotationGestureRecognizer;
    } else if (type === definition.GestureTypes.longPress) {
        nativeType = UILongPressGestureRecognizer;
    }

    return nativeType;
}

function _getSwipeDirection(direction: UISwipeGestureRecognizerDirection): definition.SwipeDirection {
    if (direction === UISwipeGestureRecognizerDirection.UISwipeGestureRecognizerDirectionDown) {
        return definition.SwipeDirection.down;
    } else if (direction === UISwipeGestureRecognizerDirection.UISwipeGestureRecognizerDirectionLeft) {
        return definition.SwipeDirection.left;
    } else if (direction === UISwipeGestureRecognizerDirection.UISwipeGestureRecognizerDirectionRight) {
        return definition.SwipeDirection.right;
    } else if (direction === UISwipeGestureRecognizerDirection.UISwipeGestureRecognizerDirectionUp) {
        return definition.SwipeDirection.up;
    }
}

function _getPinchData(args: definition.GestureEventData): definition.PinchGestureEventData {
    var recognizer = <UIPinchGestureRecognizer>args.ios;
    return <definition.PinchGestureEventData>{
        type: args.type,
        view: args.view,
        ios: args.ios,
        android: undefined,
        scale: recognizer.scale,
    };
}

function _getSwipeData(args: definition.GestureEventData): definition.SwipeGestureEventData {
    var recognizer = <UISwipeGestureRecognizer>args.ios;
    return <definition.SwipeGestureEventData>{
        type: args.type,
        view: args.view,
        ios: args.ios,
        android: undefined,
        direction: _getSwipeDirection(recognizer.direction),
    };
}

function _getPanData(args: definition.GestureEventData, view: UIView): definition.PanGestureEventData {
    var recognizer = <UIPanGestureRecognizer>args.ios;
    return <definition.PanGestureEventData>{
        type: args.type,
        view: args.view,
        ios: args.ios,
        android: undefined,
        deltaX: recognizer.translationInView(view).x,
        deltaY: recognizer.translationInView(view).y
    };
}

function _getRotationData(args: definition.GestureEventData): definition.RotationGestureEventData {
    var recognizer = <UIRotationGestureRecognizer>args.ios;
    return <definition.RotationGestureEventData>{
        type: args.type,
        view: args.view,
        ios: args.ios,
        android: undefined,
        rotation: recognizer.rotation * (180.0 / Math.PI),
    };
}
