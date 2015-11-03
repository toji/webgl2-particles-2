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
    randomSeed: 3,
  };

  function createProgram () {
    var vertexShader = gl.createShader( gl.VERTEX_SHADER );
    var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );

    gl.shaderSource( vertexShader, ['#version 300 es',
      'precision ' + renderer.getPrecision() + ' float;',

      'in vec4 position;',
      'in vec4 velocity;',
      'in vec4 origin;',
      'in highp uint randomSeed;',

      'out vec4 outPosition;',
      'out vec4 outVelocity;',
      'flat out highp uint outRandomSeed;',

      'uniform float time;',
      'uniform float timeDelta;',
      'uniform vec4 colliders[' + maxColliders + '];',

      'highp uint curRandomSeed;',

      'float rand(){',
      // Use Microsoft's Visual C++ constants for the linear congruential generator
      '  curRandomSeed = (uint(214013) * curRandomSeed + uint(2531011));',
      '  return float((curRandomSeed >> 16) & uint(0x7FFF)) / 32767.0;',
      '}',

      'void runSimulation(vec4 pos, vec4 vel, out vec4 outPos, out vec4 outVel) {',
      '  outPos.x = pos.x + vel.x;',
      '  outPos.y = pos.y + vel.y;',
      '  outPos.z = pos.z + vel.z;',
      '  outPos.w = pos.w;',
      '  outVel = vel;',
      '  if (pos.w == 1.0) {',
      '    outVel = vel * 0.95;', // Cheap drag
      '    vec3 resetVec = normalize(origin.xyz - outPos.xyz) * 0.0005;',
      '    outVel.xyz += resetVec;',
      '  }',

      // Interaction with fingertips
      '  for (int i = 0; i < ' + maxColliders + '; ++i) {',
      '    vec3 posToCollider = pos.xyz - colliders[i].xyz;',
      '    float dist = length(posToCollider);',
      '    if (dist < colliders[i].w) {',
      '      vec3 movement = normalize(posToCollider) * colliders[i].w;',
      '      outPos += vec4(movement, 0.0);',
      '      outPos.w = 1.0;', // Indicates particles has been interacted with
      '      outVel += vec4(movement * 0.1, 0.0);',
      '    }',
      // Adding a tangential velocity looks quite pretty
      '    float forceFieldDist = (colliders[i].w * 2.0 - dist);',
      '    if (forceFieldDist > 0.0) {',
      '      vec2 tangentToCollider = normalize(vec2(posToCollider.y, -posToCollider.x));',
      '      outVel.xy += tangentToCollider * 0.0007;',
      '    }',
      '  }',

      // Interaction with walls
      '  if (outPos.x < -5.2) {',
      '    outPos.x += (outPos.x + 5.2) * 2.0;',
      '    outVel.x *= -1.0;',
      '  }',
      '  if (outPos.x > 5.2) {',
      '    outPos.x += (outPos.x - 5.2) * 2.0;',
      '    outVel.x *= -1.0;',
      '  }',
      '  if (outPos.y < -2.0) {',
      '    outPos.y += (outPos.y + 2.0) * 2.0;',
      '    outVel.y *= -1.0;',
      '  }',
      '  if (outPos.y > 2.0) {',
      '    outPos.y += (outPos.y - 2.0) * 2.0;',
      '    outVel.y *= -1.0;',
      '  }',
      '  if (outPos.z < -2.56) {',
      '    outPos.z += (outPos.z + 2.56) * 2.0;',
      '    outVel.z *= -1.0;',
      '  }',
      '  if (outPos.z > 2.56) {',
      '    outPos.z += (outPos.z - 2.56) * 2.0;',
      '    outVel.z *= -1.0;',
      '  }',
      '}',

      'void main() {',
      '  vec4 pos = position;',
      '  curRandomSeed = randomSeed;',

      // Randomly end the life of the particle and reset it to it's original position
      // Moved particles reset less frequently.
      '  float resetRate = (pos.w == 1.0) ? 0.998 : 0.97;',
      '  if ( rand() > resetRate ) {',
      '    outPosition = vec4(origin.xyz, 0.0);',
      // This velocity reset should be in sync with the initialization values in index.html
      '    outVelocity = vec4((rand()-0.5) * 0.004,',
      '                       (rand()-0.5) * 0.004,',
      '                       (rand()-0.5) * 0.004,',
      '                       0.0);',
      '  } else {',
      '    runSimulation(position, velocity, outPosition, outVelocity);',
      '  }',

      '  outRandomSeed = curRandomSeed;',
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

    gl.transformFeedbackVaryings( program, ["outPosition", "outVelocity", "outRandomSeed"], gl.SEPARATE_ATTRIBS );

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
      gl.uniform1f(uniforms.timeDelta, timeDelta);
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

    getTime: function ( time ) {
      return timeValue;
    }

  }

};
