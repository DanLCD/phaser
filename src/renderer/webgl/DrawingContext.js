/**
 * @author       Benjamin D. Richards <benjamindrichards@gmail.com>
 * @copyright    2013-2024 Phaser Studio Inc.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var Class = require('../../utils/Class');
var Events = require('../events');

/**
 * Descriptor of the context within which a drawing operation is performed.
 *
 * This specifies the framebuffer, the viewport, the scissor box, and the
 * stencil state.
 *
 * This is analogous to a drafting table in a studio. The paper is the
 * framebuffer, while the rest of the data specifies masks, guides etc for
 * drawing.
 *
 * A DrawingContext can be copied and thrown away, allowing temporary use of
 * different drawing states on a framebuffer.
 *
 * @class DrawingContext
 * @memberof Phaser.Renderer.WebGL
 * @constructor
 * @since 3.90.0
 *
 * @param {Phaser.Renderer.WebGL.WebGLRenderer} renderer - The renderer that owns this context.
 * @param {object} [options] - The options for this context.
 * @param {boolean|[boolean,boolean,boolean]} [options.autoClear=true] - Whether to automatically clear the framebuffer when the context comes into use. If an array, the elements are whether to clear the color, depth, and stencil buffers respectively.
 * @param {boolean} [options.autoResize=false] - Whether to automatically resize the framebuffer if the WebGL Renderer resizes.
 * @param {number} [options.blendMode=0] - The blend mode to use when rendering.
 * @param {?Phaser.Cameras.Scene2D.Camera} [options.camera=null] - The camera to use for this context.
 * @param {[number, number, number, number]} [options.clearColor=[0, 0, 0, 0]] - The color to clear the framebuffer with.
 * @param {boolean} [options.useCanvas=false] - Whether to use the canvas as the framebuffer.
 * @param {Phaser.Renderer.WebGL.DrawingContext} [options.copyFrom] - The DrawingContext to copy from.
 */
var DrawingContext = new Class({
    initialize:

    function DrawingContext (renderer, options)
    {
        if (options === undefined) { options = {}; }

        /**
         * The renderer that owns this context.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#renderer
         * @type {Phaser.Renderer.WebGL.WebGLRenderer}
         * @since 3.90.0
         */
        this.renderer = renderer;

        /**
         * The camera used by this context. Set this using `setCamera` to ensure
         * the view matrix is updated. Ensure that this is not `null` before
         * rendering.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#camera
         * @type {?Phaser.Cameras.Scene2D.Camera}
         * @since 3.90.0
         * @readonly
         */
        this.camera = null;

        this.setCamera(options.camera || null);

        /**
         * Relevant WebGL state for the DrawingContext.
         * Contains the framebuffer, scissor box, and viewport.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#state
         * @type {Phaser.Types.Renderer.WebGL.WebGLGlobalParameters}
         */
        this.state = {
            bindings:
            {
                framebuffer: null
            },
            blend: {
                // This will be automatically populated below.
            },
            colorClearValue: options.clearColor || [ 0, 0, 0, 0 ],
            scissor: {
                box: [ 0, 0, 0, 0 ],
                enable: true
            },
            viewport: [ 0, 0, 0, 0 ]
        };

        /**
         * The blend mode to use when rendering.
         * This is an index into the renderer's blendModes array.
         * It is faster to check than the state object.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#blendMode
         * @type {number}
         * @default 0
         * @since 3.90.0
         */
        this.blendMode = -1;

        this.setBlendMode(options.blendMode || 0);

        /**
         * Which renderbuffers in the framebuffer to clear when the DrawingContext comes into use.
         * This is the mask of buffers to clear:
         * gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT, gl.STENCIL_BUFFER_BIT.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#autoClear
         * @type {number}
         * @default 0
         * @since 3.90.0
         */
        this.autoClear = 0;

        if (options.autoClear === undefined || options.autoClear === true)
        {
            this.setAutoClear(true, true, true);
        }
        else if (Array.isArray(options.autoClear))
        {
            this.setAutoClear.apply(this, options.autoClear);
        }

        /**
         * Whether to use the canvas as the framebuffer.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#useCanvas
         * @type {boolean}
         * @default false
         * @since 3.90.0
         */
        this.useCanvas = !!options.useCanvas;

        /**
         * The WebGLFramebufferWrapper which will hold the framebuffer output.
         * This may contain the canvas.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#framebuffer
         * @type {Phaser.Renderer.WebGL.Wrappers.WebGLFramebufferWrapper}
         * @since 3.90.0
         */
        this.framebuffer = null;

        /**
         * The WebGLTextureWrapper which will hold the framebuffer output.
         * This is only used if `useCanvas` is `false`.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#texture
         * @type {?Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper}
         * @default null
         * @since 3.90.0
         */
        this.texture = null;

        /**
         * Whether the DrawingContext is in use.
         * This is used to track 'spare' contexts which can be reused.
         *
         * @name Phaser.Renderer.WebGL.DrawingContext#inUse
         * @type {boolean}
         * @default false
         * @since 3.90.0
         */
        this.inUse = false;

        if (options.autoResize)
        {
            this.renderer.on(Events.RESIZE, this.resize, this);
        }

        if (options.copyFrom)
        {
            this.copy(options.copyFrom);
        }
        else
        {
            this.resize(renderer.width, renderer.height);
        }
    },

    /**
     * Resize the DrawingContext.
     *
     * Delete the framebuffer and texture, and create new ones with the new size. The scissor box and viewport are reset to match the new size.
     *
     * This method is called automatically if `autoResize` is `true` and the WebGL Renderer resizes.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#resize
     * @since 3.90.0
     * @param {number} width - The new width of the framebuffer.
     * @param {number} height - The new height of the framebuffer.
     */
    resize: function (width, height)
    {
        // TODO: dimensions were originally multiplied by `this.scale`.
        width = Math.round(width);
        height = Math.round(height);

        if (width <= 0)
        {
            width = 1;
        }

        if (height <= 0)
        {
            height = 1;
        }

        if (!this.useCanvas)
        {
            var renderer = this.renderer;
    
            renderer.deleteTexture(this.texture);
            renderer.deleteFramebuffer(this.state.bindings.framebuffer);
    
            this.texture = renderer.createTextureFromSource(null, width, height, 0, true);
            this.framebuffer = renderer.createFramebuffer(this.texture, true, false);
        }
        else if (!this.framebuffer)
        {
            // Create a framebuffer referencing the canvas.
            // This is used for the main framebuffer.
            // It does not need to resize after creation.
            this.framebuffer = this.renderer.createFramebuffer(null);
        }
        this.state.bindings.framebuffer = this.framebuffer;

        this.width = width;
        this.height = height;

        this.state.scissor.box = [ 0, 0, width, height ];
        this.state.viewport = [ 0, 0, width, height ];
    },

    /**
     * Copy the state of another DrawingContext.
     * This doesn't copy `inUse` or `autoResize`.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#copy
     * @since 3.90.0
     * @param {Phaser.Renderer.WebGL.DrawingContext} source - The DrawingContext to copy from.
     */
    copy: function (source)
    {
        var state = source.state;
        var blend = state.blend;
        var scissor = state.scissor;

        this.autoClear = source.autoClear;
        this.useCanvas = source.useCanvas;
        this.framebuffer = source.framebuffer;
        this.texture = source.texture;
        this.camera = source.camera;
        this.blendMode = source.blendMode;

        this.state = {
            bindings:
            {
                framebuffer: state.bindings.framebuffer
            },
            blend: {
                color: blend.color && blend.color.slice(),
                enable: blend.enable,
                equation: blend.equation,
                func: blend.func
            },
            colorClearValue: state.colorClearValue.slice(),
            scissor: {
                box: scissor.box.slice(),
                enable: scissor.enable
            },
            viewport: state.viewport.slice()
        };

        this.resize(source.width, source.height);
    },

    /**
     * Create a clone of the DrawingContext. This is intended to be mutated
     * for temporary use, and then thrown away.
     *
     * The autoClear setting is set to false unless specified.
     * This is because most clones reference an existing framebuffer,
     * which is intended to accumulate drawing operations.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#getClone
     * @since 3.90.0
     * @param {boolean} [preserveAutoClear=false] - Whether to preserve the autoClear setting.
     * @return {Phaser.Renderer.WebGL.DrawingContext} The cloned DrawingContext.
     */
    getClone: function (preserveAutoClear)
    {
        var context = new DrawingContext(this.renderer, { copyFrom: this });

        if (!preserveAutoClear)
        {
            context.setAutoClear(false, false, false);
        }

        return context;
    },

    /**
     * Set the buffers to clear when the DrawingContext comes into use.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#setAutoClear
     * @since 3.90.0
     * @param {boolean} color - Whether to clear the color buffer.
     * @param {boolean} depth - Whether to clear the depth buffer.
     * @param {boolean} stencil - Whether to clear the stencil buffer.
     */
    setAutoClear: function (color, depth, stencil)
    {
        var autoClear = 0;
        var gl = this.renderer.gl;
        if (color) { autoClear |= gl.COLOR_BUFFER_BIT; }
        if (depth) { autoClear |= gl.DEPTH_BUFFER_BIT; }
        if (stencil) { autoClear |= gl.STENCIL_BUFFER_BIT; }
        this.autoClear = autoClear;
    },

    /**
     * Set the blend mode for the DrawingContext.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#setBlendMode
     * @since 3.90.0
     * @param {number} blendMode - The blend mode to set.
     * @param {[number, number, number, number]} [blendColor] - The blend color to set.
     */
    setBlendMode: function (blendMode, blendColor)
    {
        if (blendMode === this.blendMode) { return; }

        var blend = this.state.blend;
        var blendModeData = this.renderer.blendModes[blendMode];

        blend.enable = blendModeData.enable;
        blend.equation = blendModeData.equation;
        blend.func = blendModeData.func;

        if (blendColor)
        {
            blend.color = blendColor;
        }
        else
        {
            blend.color = undefined;
        }

        this.blendMode = blendMode;
    },

    /**
     * Set the camera for the DrawingContext.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#setCamera
     * @since 3.90.0
     * @param {Phaser.Cameras.Scene2D.Camera} camera - The camera to set.
     */
    setCamera: function (camera)
    {
        this.camera = camera;
    },

    /**
     * Set the clear color for the DrawingContext.
     * No changes will be made if the color is the same as the current clear color.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#setClearColor
     * @since 3.90.0
     * @param {number} r - The red component of the color to clear with.
     * @param {number} g - The green component of the color to clear with.
     * @param {number} b - The blue component of the color to clear with.
     * @param {number} a - The alpha component of the color to clear with.
     */
    setClearColor: function (r, g, b, a)
    {
        var colorClearValue = this.state.colorClearValue;
        if (
            r === colorClearValue[0] &&
            g === colorClearValue[1] &&
            b === colorClearValue[2] &&
            a === colorClearValue[3]
        ) { return; }

        this.state.colorClearValue = [ r, g, b, a ];
    },

    /**
     * Set the scissor box for the DrawingContext.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#setScissorBox
     * @since 3.90.0
     * @param {number} x - The x coordinate of the scissor box.
     * @param {number} y - The y coordinate of the scissor box.
     * @param {number} width - The width of the scissor box.
     * @param {number} height - The height of the scissor box.
     */
    setScissorBox: function (x, y, width, height)
    {
        this.state.scissor.box = [ x, y, width, height ];
    },

    /**
     * Enable or disable the scissor box for the DrawingContext.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#setScissorEnable
     * @since 3.90.0
     * @param {boolean} enable - Whether to enable the scissor box.
     */
    setScissorEnable: function (enable)
    {
        this.state.scissor.enable = enable;
    },

    /**
     * Begin using the DrawingContext. This marks the context as in use.
     * This will finish any outstanding batches.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#use
     * @since 3.90.0
     */
    use: function ()
    {
        // Finish any outstanding batches.
        this.renderer.renderNodes.setCurrentBatchNode(null);

        this.inUse = true;

        if (this.autoClear)
        {
            this.clear();
        }
    },

    /**
     * End using the DrawingContext. This marks the context as not in use,
     * so its framebuffer and texture are not needed any more
     * and may be cleared at any time. This will finish any outstanding batches.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#release
     * @since 3.90.0
     */
    release: function ()
    {
        this.inUse = false;

        // Finish any outstanding batches.
        this.renderer.renderNodes.setCurrentBatchNode(null);
    },

    /**
     * Begin drawing with the DrawingContext.
     *
     * This should be called before rendering to set up the framebuffer
     * and other WebGL state.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#beginDraw
     * @since 3.90.0
     */
    beginDraw: function ()
    {
        this.renderer.glWrapper.update(this.state);
    },

    /**
     * Clear the framebuffer. This will bind the framebuffer.
     *
     * @method Phaser.Renderer.WebGL.DrawingContext#clear
     * @since 3.90.0
     */
    clear: function ()
    {
        this.beginDraw();

        this.renderer.gl.clear(this.autoClear);
    }
});

module.exports = DrawingContext;