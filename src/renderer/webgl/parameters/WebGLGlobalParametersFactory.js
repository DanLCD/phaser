/**
 * @author       Benjamin D. Richards <benjamindrichards@gmail.com>
 * @copyright    2013-2024 Phaser Studio Inc.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var CONST = require('../../../const');
var DeepCopy = require('../../../utils/object/DeepCopy');
var WebGLStencilParametersFactory = require('./WebGLStencilParametersFactory');

/**
 * Factory for creating a WebGLGlobalParameters.
 */
var WebGLGlobalParametersFactory = {

    /**
     * Creates a new WebGLGlobalParameters.
     *
     * @method Phaser.Renderer.WebGL.WebGLGlobalParameters#getDefault
     * @since 3.90.0
     * @param {Phaser.Renderers.WebGL.WebGLRenderer} renderer - The WebGLRenderer to create the WebGLGlobalParameters for.
     * @returns {Phaser.Types.Renderer.WebGL.WebGLGlobalParameters} The default WebGLGlobalParameters.
     */
    getDefault: function (renderer)
    {
        var parameters = {
            bindings: {
                activeTexture: 0,
                arrayBuffer: null,
                elementArrayBuffer: null,
                framebuffer: null,
                program: null
            },
            blend: DeepCopy(renderer.blendModes[CONST.BlendModes.NORMAL]),
            colorClearValue: [ 0, 0, 0, 1 ],
            colorWritemask: [ true, true, true, true ],
            cullFace: false,
            depthTest: false,
            scissor: {
                enable: false,
                box: [ 0, 0, 0, 0 ]
            },
            stencil: WebGLStencilParametersFactory.create(renderer),
            texturing: {
                flipY: false,
                premultiplyAlpha: false
            },
            viewport: [ 0, 0, 0, 0 ]
        };

        return parameters;
    }
};

module.exports = WebGLGlobalParametersFactory;