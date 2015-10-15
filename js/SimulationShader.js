/*
Copyright (c) 2015, Brandon Jones.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

var SimulationShader = function (renderer, maxColliders) {
  var gl = renderer.context;
  if (!maxColliders) maxColliders = 8;

  var attributes = {
    position: 0,
    velocity: 1,
    origin: 2,
  };

  function createProgram () {
    var vertexShader = gl.createShader( gl.VERTEX_SHADER );
    var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );

    gl.shaderSource( vertexShader, ['#version 300 es',
      'precision ' + renderer.getPrecision() + ' float;',

      'in vec4 position;',
      'in vec4 velocity;',
      'in vec4 origin;',

      'out vec4 outPosition;',
      'out vec4 outVelocity;',

      'uniform float time;',
      'uniform float timeDelta;',
      'uniform vec4 colliders[' + maxColliders + '];',

      'float rand(vec2 co){',
      '  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);',
      '}',

      'vec4 runSimulation(vec4 pos) {',
      '  pos.x = pos.x + (velocity.x * timeDelta);',
      '  pos.y = pos.y + (velocity.y * timeDelta);',
      '  pos.z = pos.z + (velocity.z * timeDelta);',

      // Interaction with fingertips
      '  for (int i = 0; i < ' + maxColliders + '; ++i) {',
      '    vec3 posToCollider = pos.xyz - colliders[i].xyz;',
      '    float dist = colliders[i].w - length(posToCollider);',
      '    if (dist > 0.0) {',
      '      pos += vec4(normalize(posToCollider) * colliders[i].w, 0.0);',
      '    }',
      '  }',
      '  return pos;',
      '}',

      'void main() {',
      '  vec4 pos = position;',

      // Randomly end the life of the particle and reset it to it's original position
      '  if ( rand(position.xy + time) > 0.97 ) {',
      '    pos = vec4(origin.xyz, 0.0);',
      '  } else {',
      '    pos = runSimulation(pos);',
      '  }',

      '  // Write new attributes out',
      '  outPosition = pos;',
      '  outVelocity = velocity;',
      '}'
    ].join( '\n' ) );

    gl.shaderSource( fragmentShader, ['#version 300 es',
      'precision ' + renderer.getPrecision() + ' float;',

      'out vec4 fragColor;',

      'void main() {',
        'fragColor = vec4(1.0, 1.0, 1.0, 1.0);',
      '}'
    ].join( '\n' ) );

    gl.compileShader( vertexShader );
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("Shader failed to compile", gl.getShaderInfoLog( vertexShader ));
      return null;
    }

    gl.compileShader( fragmentShader );
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error("Shader failed to compile", gl.getShaderInfoLog( fragmentShader ));
      return null;
    }

    var program = gl.createProgram();

    gl.attachShader( program, vertexShader );
    gl.attachShader( program, fragmentShader );

    gl.deleteShader( vertexShader );
    gl.deleteShader( fragmentShader );

    for (var i in attributes) {
      gl.bindAttribLocation( program, attributes[i], i );
    }

    gl.transformFeedbackVaryings( program, ["outPosition", "outVelocity"], gl.SEPARATE_ATTRIBS );

    gl.linkProgram( program );

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Shader program failed to link", gl.getProgramInfoLog( program ));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  };

  var program = createProgram();

  if (!program) {
    return null;
  }

  var uniforms = {};
  var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (var i = 0; i < count; i++) {
      uniform = gl.getActiveUniform(program, i);
      name = uniform.name.replace("[0]", "");
      uniforms[name] = gl.getUniformLocation(program, name);
  }

  var timeValue = 0;
  var timeDelta = 0;
  var collidersValue = null;

  return {
    program: program,

    attributes: attributes,

    bind: function() {
      gl.useProgram(program);
      gl.uniform1f(uniforms.time, timeValue);
      gl.uniform1f(uniforms.timeDelta, timeDelta * 0.0001);
      gl.uniform4fv(uniforms.colliders, collidersValue);
    },

    setColliders: function ( colliders ) {
      collidersValue = colliders;
    },

    setTime: function ( time ) {
      if (timeValue != 0) {
        timeDelta = timeValue - time;
      }
      timeValue = time;
    },

  }

};
