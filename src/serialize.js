import homunculus from 'homunculus';
import join from './join';
import sort from './sort';

var Token = homunculus.getClass('token', 'css');
var Node = homunculus.getClass('node', 'css');

function parse(node) {
  var res = {};
  node.leaves().forEach(function(leaf, i) {
    styleset(leaf, i, res);
  });
  //depth(res);
  return res;
}

function styleset(node, i, res) {
  var sels = selectors(node.first());
  var styles = block(node.last());
  sels.forEach(function(sel) {
    record(sel, i, styles, res);
  });
}
function selectors(node) {
  var res = [];
  node.leaves().forEach(function(leaf) {
    if(leaf.name() == Node.SELECTOR) {
      res.push(selector(leaf));
    }
  });
  return res;
}
function selector(node) {
  return node.leaves().map(function(leaf) {
    return leaf.token();
  });
}
function block(node) {
  var res = [];
  node.leaves().forEach(function(leaf) {
    if(leaf.name() == Node.STYLE) {
      res.push(style(leaf));
    }
  });
  return res;
}
function style(node) {
  var s = join(node, true).trim();
  s = s.replace(/;$/, '');
  return s;
}

function record(sel, idx, styles, res) {
  var _p = 0;
  for(var i = sel.length - 1; i >= 0; i--) {
    var temp = {
      s: [],
      a: [],
      p: []
    };
    var t = sel[i];
    var s = t.content();
    _p += priority(t, s);
    switch(t.type()) {
      case Token.SELECTOR:
        temp.s.push(s);
        break;
      case Token.PSEUDO:
        temp.p.push(s.replace(/^:+/, ''));
        break;
      case Token.SIGN:
        switch(s) {
          case ']':
            var item;
            i--;
            item = [];
            t = t.prev();
            while(t) {
              i--;
              s = t.content();
              if(s == '[') {
                break;
              }
              t = t.prev();
              s = s.replace(/^(['"'])(.*)\1/, '$2');
              item.unshift(s);
            }
            temp.a.push({
              v: item,
              s: item.join('')
            });
            break;
        }
        break;
    }
    t = t.prev();
    while(t && !isSplit(t)) {
      s = t.content();
      _p += priority(t, s);
      switch(t.type()) {
        case Token.SELECTOR:
          temp.s.push(s);
          break;
        case Token.PSEUDO:
          temp.p.push(s.replace(/^:+/, ''));
          break;
        case Token.SIGN:
          switch(s) {
            case ']':
              var item;
              i--;
              item = [];
              t = t.prev();
              while(t) {
                i--;
                s = t.content();
                if(s == '[') {
                  break;
                }
                t = t.prev();
                s = s.replace(/^(['"'])(.*)\1/, '$2');
                item.unshift(s);
              }
              temp.a.push({
                v: item,
                s: item.join('')
              });
              break;
          }
          break;
      }
      t = t.prev();
      i--;
    }
    res = save(temp, res);
  }
  res._v = res._v || [];
  styles.forEach(function(style) {
    res._v.push([idx, style]);
  });
  res._p = _p;
}

function priority(token, s) {
  switch(token.type()) {
    case Token.SELECTOR:
      if(s.charAt(0) == '#') {
        return 100;
      }
      else if(s.charAt(0) == '.') {
        return 10;
      }
      return 1;
    case Token.PSEUDO:
      return 1;
    case Token.SIGN:
      if(s == ']') {
        return 10;
      }
      break;
  }
  return 0;
}

function depth(res) {
  var keys = Object.keys(res);
  //_:伪类
  if(res.hasOwnProperty('_:')) {
    res['_:'].forEach(function(item) {
      depth(item[1]);
    });
  }
  //_[属性
  if(res.hasOwnProperty('_[')) {
    res['_['].forEach(function(item) {
      depth(item[1]);
    });
  }
  //普通样式深度
  keys = keys.filter(function(k) {
    return k.charAt(0) != '_';
  });
  if(keys.length) {
    var i = 0;
    keys.forEach(function(k) {
      var item = res[k];
      i = Math.max(depth(item), i);
    });
    if(i) {
      res._d = i;
    }
    return i + 1;
  }
  else {
    return 0;
  }
}

function isSplit(token) {
  if(token.type() == Token.BLANK) {
    return true;
  }
  if(token.type() == Token.LINE) {
    return true;
  }
  if(token.type() == Token.SIGN) {
    return ['>', '+', '~', '{', '}', ','].indexOf(token.content()) > -1;
  }
  return false;
}

function save(temp, res) {
  if(!temp.s.length) {
    temp.s.push('*');
  }
  //selector按name/class/id排序
  sort(temp.s, function(a, b) {
    return a != '*' && a < b || b == '*';
  });
  var star = temp.s[0] == '*';
  //*开头有几种组合，记录之
  if(star) {
    res['_*'] = true;
    if(temp.s.length > 1) {
      if(temp.s.length > 2) {
        res['_*.#'] = true;
      }
      else if(temp.s[1][0] == '.') {
        res['_*.'] = true;
      }
      else {
        res['_*#'] = true;
      }
    }
  }
  var s = temp.s.join('');
  res[s] = res[s] || {};
  res = res[s];
  //伪类
  if(temp.p.length) {
    res['_:'] = res['_:'] || [];
    var pseudos = res['_:'];
    var pseudo = [];
    temp.p.forEach(function(item) {
      //防止多次重复
      if(pseudo.indexOf(item) == -1) {
        pseudo.push(item);
      }
    });
    //排序后比对，可能重复，合并之如a:hover{...}a:hover{...}会生成2个hover数组
    sort(pseudo, function(a, b) {
      return a < b;
    });
    var isExist = -1;
    for(var j = 0, len = pseudos.length; j < len; j++) {
      if(pseudos[j][0].join(',') == pseudo.join(',')) {
        isExist = j;
        break;
      }
    }
    if(isExist > -1) {
      res = pseudos[isExist][1];
    }
    else {
      var arr = [];
      arr.push(pseudo);
      res = {};
      arr.push(res);
      pseudos.push(arr);
    }
  }
  //属性
  if(temp.a.length) {
    res['_['] = res['_['] || [];
    var attrs = res['_['];
    var attr = [];
    //去重并排序
    sort(temp.a, function(a, b) {
      return a.s < b.s;
    });
    var hash = {};
    temp.a.forEach(function(item) {
      if(!hash.hasOwnProperty(item.s)) {
        attr.push(item.v);
      }
    });
    var isExist = -1;
    var join = '';
    join += attr.map(function(item) {
      return item.join('');
    });
    for(var j = 0, len = attrs.length; j < len; j++) {
      var s1 = '';
      s1 += attrs[j][0].map(function(item) {
        return item.join('');
      });
      if(s1 == join) {
        isExist = j;
        break;
      }
    }
    if(isExist > -1) {
      res = attrs[isExist][1];
    }
    else {
      var arr = [];
      arr.push(attr);
      res = {};
      arr.push(res);
      attrs.push(arr);
    }
  }
  return res;
}

export default parse;