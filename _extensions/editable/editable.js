var EditableModule = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/fast-diff/diff.js
  var require_diff = __commonJS({
    "node_modules/fast-diff/diff.js"(exports2, module2) {
      var DIFF_DELETE = -1;
      var DIFF_INSERT = 1;
      var DIFF_EQUAL = 0;
      function diff_main(text1, text2, cursor_pos, cleanup, _fix_unicode) {
        if (text1 === text2) {
          if (text1) {
            return [[DIFF_EQUAL, text1]];
          }
          return [];
        }
        if (cursor_pos != null) {
          var editdiff = find_cursor_edit_diff(text1, text2, cursor_pos);
          if (editdiff) {
            return editdiff;
          }
        }
        var commonlength = diff_commonPrefix(text1, text2);
        var commonprefix = text1.substring(0, commonlength);
        text1 = text1.substring(commonlength);
        text2 = text2.substring(commonlength);
        commonlength = diff_commonSuffix(text1, text2);
        var commonsuffix = text1.substring(text1.length - commonlength);
        text1 = text1.substring(0, text1.length - commonlength);
        text2 = text2.substring(0, text2.length - commonlength);
        var diffs = diff_compute_(text1, text2);
        if (commonprefix) {
          diffs.unshift([DIFF_EQUAL, commonprefix]);
        }
        if (commonsuffix) {
          diffs.push([DIFF_EQUAL, commonsuffix]);
        }
        diff_cleanupMerge(diffs, _fix_unicode);
        if (cleanup) {
          diff_cleanupSemantic(diffs);
        }
        return diffs;
      }
      function diff_compute_(text1, text2) {
        var diffs;
        if (!text1) {
          return [[DIFF_INSERT, text2]];
        }
        if (!text2) {
          return [[DIFF_DELETE, text1]];
        }
        var longtext = text1.length > text2.length ? text1 : text2;
        var shorttext = text1.length > text2.length ? text2 : text1;
        var i = longtext.indexOf(shorttext);
        if (i !== -1) {
          diffs = [
            [DIFF_INSERT, longtext.substring(0, i)],
            [DIFF_EQUAL, shorttext],
            [DIFF_INSERT, longtext.substring(i + shorttext.length)]
          ];
          if (text1.length > text2.length) {
            diffs[0][0] = diffs[2][0] = DIFF_DELETE;
          }
          return diffs;
        }
        if (shorttext.length === 1) {
          return [
            [DIFF_DELETE, text1],
            [DIFF_INSERT, text2]
          ];
        }
        var hm = diff_halfMatch_(text1, text2);
        if (hm) {
          var text1_a = hm[0];
          var text1_b = hm[1];
          var text2_a = hm[2];
          var text2_b = hm[3];
          var mid_common = hm[4];
          var diffs_a = diff_main(text1_a, text2_a);
          var diffs_b = diff_main(text1_b, text2_b);
          return diffs_a.concat([[DIFF_EQUAL, mid_common]], diffs_b);
        }
        return diff_bisect_(text1, text2);
      }
      function diff_bisect_(text1, text2) {
        var text1_length = text1.length;
        var text2_length = text2.length;
        var max_d = Math.ceil((text1_length + text2_length) / 2);
        var v_offset = max_d;
        var v_length = 2 * max_d;
        var v1 = new Array(v_length);
        var v2 = new Array(v_length);
        for (var x = 0; x < v_length; x++) {
          v1[x] = -1;
          v2[x] = -1;
        }
        v1[v_offset + 1] = 0;
        v2[v_offset + 1] = 0;
        var delta = text1_length - text2_length;
        var front = delta % 2 !== 0;
        var k1start = 0;
        var k1end = 0;
        var k2start = 0;
        var k2end = 0;
        for (var d = 0; d < max_d; d++) {
          for (var k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
            var k1_offset = v_offset + k1;
            var x1;
            if (k1 === -d || k1 !== d && v1[k1_offset - 1] < v1[k1_offset + 1]) {
              x1 = v1[k1_offset + 1];
            } else {
              x1 = v1[k1_offset - 1] + 1;
            }
            var y1 = x1 - k1;
            while (x1 < text1_length && y1 < text2_length && text1.charAt(x1) === text2.charAt(y1)) {
              x1++;
              y1++;
            }
            v1[k1_offset] = x1;
            if (x1 > text1_length) {
              k1end += 2;
            } else if (y1 > text2_length) {
              k1start += 2;
            } else if (front) {
              var k2_offset = v_offset + delta - k1;
              if (k2_offset >= 0 && k2_offset < v_length && v2[k2_offset] !== -1) {
                var x2 = text1_length - v2[k2_offset];
                if (x1 >= x2) {
                  return diff_bisectSplit_(text1, text2, x1, y1);
                }
              }
            }
          }
          for (var k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
            var k2_offset = v_offset + k2;
            var x2;
            if (k2 === -d || k2 !== d && v2[k2_offset - 1] < v2[k2_offset + 1]) {
              x2 = v2[k2_offset + 1];
            } else {
              x2 = v2[k2_offset - 1] + 1;
            }
            var y2 = x2 - k2;
            while (x2 < text1_length && y2 < text2_length && text1.charAt(text1_length - x2 - 1) === text2.charAt(text2_length - y2 - 1)) {
              x2++;
              y2++;
            }
            v2[k2_offset] = x2;
            if (x2 > text1_length) {
              k2end += 2;
            } else if (y2 > text2_length) {
              k2start += 2;
            } else if (!front) {
              var k1_offset = v_offset + delta - k2;
              if (k1_offset >= 0 && k1_offset < v_length && v1[k1_offset] !== -1) {
                var x1 = v1[k1_offset];
                var y1 = v_offset + x1 - k1_offset;
                x2 = text1_length - x2;
                if (x1 >= x2) {
                  return diff_bisectSplit_(text1, text2, x1, y1);
                }
              }
            }
          }
        }
        return [
          [DIFF_DELETE, text1],
          [DIFF_INSERT, text2]
        ];
      }
      function diff_bisectSplit_(text1, text2, x, y) {
        var text1a = text1.substring(0, x);
        var text2a = text2.substring(0, y);
        var text1b = text1.substring(x);
        var text2b = text2.substring(y);
        var diffs = diff_main(text1a, text2a);
        var diffsb = diff_main(text1b, text2b);
        return diffs.concat(diffsb);
      }
      function diff_commonPrefix(text1, text2) {
        if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
          return 0;
        }
        var pointermin = 0;
        var pointermax = Math.min(text1.length, text2.length);
        var pointermid = pointermax;
        var pointerstart = 0;
        while (pointermin < pointermid) {
          if (text1.substring(pointerstart, pointermid) == text2.substring(pointerstart, pointermid)) {
            pointermin = pointermid;
            pointerstart = pointermin;
          } else {
            pointermax = pointermid;
          }
          pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
        }
        if (is_surrogate_pair_start(text1.charCodeAt(pointermid - 1))) {
          pointermid--;
        }
        return pointermid;
      }
      function diff_commonOverlap_(text1, text2) {
        var text1_length = text1.length;
        var text2_length = text2.length;
        if (text1_length == 0 || text2_length == 0) {
          return 0;
        }
        if (text1_length > text2_length) {
          text1 = text1.substring(text1_length - text2_length);
        } else if (text1_length < text2_length) {
          text2 = text2.substring(0, text1_length);
        }
        var text_length = Math.min(text1_length, text2_length);
        if (text1 == text2) {
          return text_length;
        }
        var best = 0;
        var length = 1;
        while (true) {
          var pattern = text1.substring(text_length - length);
          var found = text2.indexOf(pattern);
          if (found == -1) {
            return best;
          }
          length += found;
          if (found == 0 || text1.substring(text_length - length) == text2.substring(0, length)) {
            best = length;
            length++;
          }
        }
      }
      function diff_commonSuffix(text1, text2) {
        if (!text1 || !text2 || text1.slice(-1) !== text2.slice(-1)) {
          return 0;
        }
        var pointermin = 0;
        var pointermax = Math.min(text1.length, text2.length);
        var pointermid = pointermax;
        var pointerend = 0;
        while (pointermin < pointermid) {
          if (text1.substring(text1.length - pointermid, text1.length - pointerend) == text2.substring(text2.length - pointermid, text2.length - pointerend)) {
            pointermin = pointermid;
            pointerend = pointermin;
          } else {
            pointermax = pointermid;
          }
          pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
        }
        if (is_surrogate_pair_end(text1.charCodeAt(text1.length - pointermid))) {
          pointermid--;
        }
        return pointermid;
      }
      function diff_halfMatch_(text1, text2) {
        var longtext = text1.length > text2.length ? text1 : text2;
        var shorttext = text1.length > text2.length ? text2 : text1;
        if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
          return null;
        }
        function diff_halfMatchI_(longtext2, shorttext2, i) {
          var seed = longtext2.substring(i, i + Math.floor(longtext2.length / 4));
          var j = -1;
          var best_common = "";
          var best_longtext_a, best_longtext_b, best_shorttext_a, best_shorttext_b;
          while ((j = shorttext2.indexOf(seed, j + 1)) !== -1) {
            var prefixLength = diff_commonPrefix(
              longtext2.substring(i),
              shorttext2.substring(j)
            );
            var suffixLength = diff_commonSuffix(
              longtext2.substring(0, i),
              shorttext2.substring(0, j)
            );
            if (best_common.length < suffixLength + prefixLength) {
              best_common = shorttext2.substring(j - suffixLength, j) + shorttext2.substring(j, j + prefixLength);
              best_longtext_a = longtext2.substring(0, i - suffixLength);
              best_longtext_b = longtext2.substring(i + prefixLength);
              best_shorttext_a = shorttext2.substring(0, j - suffixLength);
              best_shorttext_b = shorttext2.substring(j + prefixLength);
            }
          }
          if (best_common.length * 2 >= longtext2.length) {
            return [
              best_longtext_a,
              best_longtext_b,
              best_shorttext_a,
              best_shorttext_b,
              best_common
            ];
          } else {
            return null;
          }
        }
        var hm1 = diff_halfMatchI_(
          longtext,
          shorttext,
          Math.ceil(longtext.length / 4)
        );
        var hm2 = diff_halfMatchI_(
          longtext,
          shorttext,
          Math.ceil(longtext.length / 2)
        );
        var hm;
        if (!hm1 && !hm2) {
          return null;
        } else if (!hm2) {
          hm = hm1;
        } else if (!hm1) {
          hm = hm2;
        } else {
          hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
        }
        var text1_a, text1_b, text2_a, text2_b;
        if (text1.length > text2.length) {
          text1_a = hm[0];
          text1_b = hm[1];
          text2_a = hm[2];
          text2_b = hm[3];
        } else {
          text2_a = hm[0];
          text2_b = hm[1];
          text1_a = hm[2];
          text1_b = hm[3];
        }
        var mid_common = hm[4];
        return [text1_a, text1_b, text2_a, text2_b, mid_common];
      }
      function diff_cleanupSemantic(diffs) {
        var changes = false;
        var equalities = [];
        var equalitiesLength = 0;
        var lastequality = null;
        var pointer = 0;
        var length_insertions1 = 0;
        var length_deletions1 = 0;
        var length_insertions2 = 0;
        var length_deletions2 = 0;
        while (pointer < diffs.length) {
          if (diffs[pointer][0] == DIFF_EQUAL) {
            equalities[equalitiesLength++] = pointer;
            length_insertions1 = length_insertions2;
            length_deletions1 = length_deletions2;
            length_insertions2 = 0;
            length_deletions2 = 0;
            lastequality = diffs[pointer][1];
          } else {
            if (diffs[pointer][0] == DIFF_INSERT) {
              length_insertions2 += diffs[pointer][1].length;
            } else {
              length_deletions2 += diffs[pointer][1].length;
            }
            if (lastequality && lastequality.length <= Math.max(length_insertions1, length_deletions1) && lastequality.length <= Math.max(length_insertions2, length_deletions2)) {
              diffs.splice(equalities[equalitiesLength - 1], 0, [
                DIFF_DELETE,
                lastequality
              ]);
              diffs[equalities[equalitiesLength - 1] + 1][0] = DIFF_INSERT;
              equalitiesLength--;
              equalitiesLength--;
              pointer = equalitiesLength > 0 ? equalities[equalitiesLength - 1] : -1;
              length_insertions1 = 0;
              length_deletions1 = 0;
              length_insertions2 = 0;
              length_deletions2 = 0;
              lastequality = null;
              changes = true;
            }
          }
          pointer++;
        }
        if (changes) {
          diff_cleanupMerge(diffs);
        }
        diff_cleanupSemanticLossless(diffs);
        pointer = 1;
        while (pointer < diffs.length) {
          if (diffs[pointer - 1][0] == DIFF_DELETE && diffs[pointer][0] == DIFF_INSERT) {
            var deletion = diffs[pointer - 1][1];
            var insertion = diffs[pointer][1];
            var overlap_length1 = diff_commonOverlap_(deletion, insertion);
            var overlap_length2 = diff_commonOverlap_(insertion, deletion);
            if (overlap_length1 >= overlap_length2) {
              if (overlap_length1 >= deletion.length / 2 || overlap_length1 >= insertion.length / 2) {
                diffs.splice(pointer, 0, [
                  DIFF_EQUAL,
                  insertion.substring(0, overlap_length1)
                ]);
                diffs[pointer - 1][1] = deletion.substring(
                  0,
                  deletion.length - overlap_length1
                );
                diffs[pointer + 1][1] = insertion.substring(overlap_length1);
                pointer++;
              }
            } else {
              if (overlap_length2 >= deletion.length / 2 || overlap_length2 >= insertion.length / 2) {
                diffs.splice(pointer, 0, [
                  DIFF_EQUAL,
                  deletion.substring(0, overlap_length2)
                ]);
                diffs[pointer - 1][0] = DIFF_INSERT;
                diffs[pointer - 1][1] = insertion.substring(
                  0,
                  insertion.length - overlap_length2
                );
                diffs[pointer + 1][0] = DIFF_DELETE;
                diffs[pointer + 1][1] = deletion.substring(overlap_length2);
                pointer++;
              }
            }
            pointer++;
          }
          pointer++;
        }
      }
      var nonAlphaNumericRegex_ = /[^a-zA-Z0-9]/;
      var whitespaceRegex_ = /\s/;
      var linebreakRegex_ = /[\r\n]/;
      var blanklineEndRegex_ = /\n\r?\n$/;
      var blanklineStartRegex_ = /^\r?\n\r?\n/;
      function diff_cleanupSemanticLossless(diffs) {
        function diff_cleanupSemanticScore_(one, two) {
          if (!one || !two) {
            return 6;
          }
          var char1 = one.charAt(one.length - 1);
          var char2 = two.charAt(0);
          var nonAlphaNumeric1 = char1.match(nonAlphaNumericRegex_);
          var nonAlphaNumeric2 = char2.match(nonAlphaNumericRegex_);
          var whitespace1 = nonAlphaNumeric1 && char1.match(whitespaceRegex_);
          var whitespace2 = nonAlphaNumeric2 && char2.match(whitespaceRegex_);
          var lineBreak1 = whitespace1 && char1.match(linebreakRegex_);
          var lineBreak2 = whitespace2 && char2.match(linebreakRegex_);
          var blankLine1 = lineBreak1 && one.match(blanklineEndRegex_);
          var blankLine2 = lineBreak2 && two.match(blanklineStartRegex_);
          if (blankLine1 || blankLine2) {
            return 5;
          } else if (lineBreak1 || lineBreak2) {
            return 4;
          } else if (nonAlphaNumeric1 && !whitespace1 && whitespace2) {
            return 3;
          } else if (whitespace1 || whitespace2) {
            return 2;
          } else if (nonAlphaNumeric1 || nonAlphaNumeric2) {
            return 1;
          }
          return 0;
        }
        var pointer = 1;
        while (pointer < diffs.length - 1) {
          if (diffs[pointer - 1][0] == DIFF_EQUAL && diffs[pointer + 1][0] == DIFF_EQUAL) {
            var equality1 = diffs[pointer - 1][1];
            var edit = diffs[pointer][1];
            var equality2 = diffs[pointer + 1][1];
            var commonOffset = diff_commonSuffix(equality1, edit);
            if (commonOffset) {
              var commonString = edit.substring(edit.length - commonOffset);
              equality1 = equality1.substring(0, equality1.length - commonOffset);
              edit = commonString + edit.substring(0, edit.length - commonOffset);
              equality2 = commonString + equality2;
            }
            var bestEquality1 = equality1;
            var bestEdit = edit;
            var bestEquality2 = equality2;
            var bestScore = diff_cleanupSemanticScore_(equality1, edit) + diff_cleanupSemanticScore_(edit, equality2);
            while (edit.charAt(0) === equality2.charAt(0)) {
              equality1 += edit.charAt(0);
              edit = edit.substring(1) + equality2.charAt(0);
              equality2 = equality2.substring(1);
              var score = diff_cleanupSemanticScore_(equality1, edit) + diff_cleanupSemanticScore_(edit, equality2);
              if (score >= bestScore) {
                bestScore = score;
                bestEquality1 = equality1;
                bestEdit = edit;
                bestEquality2 = equality2;
              }
            }
            if (diffs[pointer - 1][1] != bestEquality1) {
              if (bestEquality1) {
                diffs[pointer - 1][1] = bestEquality1;
              } else {
                diffs.splice(pointer - 1, 1);
                pointer--;
              }
              diffs[pointer][1] = bestEdit;
              if (bestEquality2) {
                diffs[pointer + 1][1] = bestEquality2;
              } else {
                diffs.splice(pointer + 1, 1);
                pointer--;
              }
            }
          }
          pointer++;
        }
      }
      function diff_cleanupMerge(diffs, fix_unicode) {
        diffs.push([DIFF_EQUAL, ""]);
        var pointer = 0;
        var count_delete = 0;
        var count_insert = 0;
        var text_delete = "";
        var text_insert = "";
        var commonlength;
        while (pointer < diffs.length) {
          if (pointer < diffs.length - 1 && !diffs[pointer][1]) {
            diffs.splice(pointer, 1);
            continue;
          }
          switch (diffs[pointer][0]) {
            case DIFF_INSERT:
              count_insert++;
              text_insert += diffs[pointer][1];
              pointer++;
              break;
            case DIFF_DELETE:
              count_delete++;
              text_delete += diffs[pointer][1];
              pointer++;
              break;
            case DIFF_EQUAL:
              var previous_equality = pointer - count_insert - count_delete - 1;
              if (fix_unicode) {
                if (previous_equality >= 0 && ends_with_pair_start(diffs[previous_equality][1])) {
                  var stray = diffs[previous_equality][1].slice(-1);
                  diffs[previous_equality][1] = diffs[previous_equality][1].slice(
                    0,
                    -1
                  );
                  text_delete = stray + text_delete;
                  text_insert = stray + text_insert;
                  if (!diffs[previous_equality][1]) {
                    diffs.splice(previous_equality, 1);
                    pointer--;
                    var k = previous_equality - 1;
                    if (diffs[k] && diffs[k][0] === DIFF_INSERT) {
                      count_insert++;
                      text_insert = diffs[k][1] + text_insert;
                      k--;
                    }
                    if (diffs[k] && diffs[k][0] === DIFF_DELETE) {
                      count_delete++;
                      text_delete = diffs[k][1] + text_delete;
                      k--;
                    }
                    previous_equality = k;
                  }
                }
                if (starts_with_pair_end(diffs[pointer][1])) {
                  var stray = diffs[pointer][1].charAt(0);
                  diffs[pointer][1] = diffs[pointer][1].slice(1);
                  text_delete += stray;
                  text_insert += stray;
                }
              }
              if (pointer < diffs.length - 1 && !diffs[pointer][1]) {
                diffs.splice(pointer, 1);
                break;
              }
              if (text_delete.length > 0 || text_insert.length > 0) {
                if (text_delete.length > 0 && text_insert.length > 0) {
                  commonlength = diff_commonPrefix(text_insert, text_delete);
                  if (commonlength !== 0) {
                    if (previous_equality >= 0) {
                      diffs[previous_equality][1] += text_insert.substring(
                        0,
                        commonlength
                      );
                    } else {
                      diffs.splice(0, 0, [
                        DIFF_EQUAL,
                        text_insert.substring(0, commonlength)
                      ]);
                      pointer++;
                    }
                    text_insert = text_insert.substring(commonlength);
                    text_delete = text_delete.substring(commonlength);
                  }
                  commonlength = diff_commonSuffix(text_insert, text_delete);
                  if (commonlength !== 0) {
                    diffs[pointer][1] = text_insert.substring(text_insert.length - commonlength) + diffs[pointer][1];
                    text_insert = text_insert.substring(
                      0,
                      text_insert.length - commonlength
                    );
                    text_delete = text_delete.substring(
                      0,
                      text_delete.length - commonlength
                    );
                  }
                }
                var n = count_insert + count_delete;
                if (text_delete.length === 0 && text_insert.length === 0) {
                  diffs.splice(pointer - n, n);
                  pointer = pointer - n;
                } else if (text_delete.length === 0) {
                  diffs.splice(pointer - n, n, [DIFF_INSERT, text_insert]);
                  pointer = pointer - n + 1;
                } else if (text_insert.length === 0) {
                  diffs.splice(pointer - n, n, [DIFF_DELETE, text_delete]);
                  pointer = pointer - n + 1;
                } else {
                  diffs.splice(
                    pointer - n,
                    n,
                    [DIFF_DELETE, text_delete],
                    [DIFF_INSERT, text_insert]
                  );
                  pointer = pointer - n + 2;
                }
              }
              if (pointer !== 0 && diffs[pointer - 1][0] === DIFF_EQUAL) {
                diffs[pointer - 1][1] += diffs[pointer][1];
                diffs.splice(pointer, 1);
              } else {
                pointer++;
              }
              count_insert = 0;
              count_delete = 0;
              text_delete = "";
              text_insert = "";
              break;
          }
        }
        if (diffs[diffs.length - 1][1] === "") {
          diffs.pop();
        }
        var changes = false;
        pointer = 1;
        while (pointer < diffs.length - 1) {
          if (diffs[pointer - 1][0] === DIFF_EQUAL && diffs[pointer + 1][0] === DIFF_EQUAL) {
            if (diffs[pointer][1].substring(
              diffs[pointer][1].length - diffs[pointer - 1][1].length
            ) === diffs[pointer - 1][1]) {
              diffs[pointer][1] = diffs[pointer - 1][1] + diffs[pointer][1].substring(
                0,
                diffs[pointer][1].length - diffs[pointer - 1][1].length
              );
              diffs[pointer + 1][1] = diffs[pointer - 1][1] + diffs[pointer + 1][1];
              diffs.splice(pointer - 1, 1);
              changes = true;
            } else if (diffs[pointer][1].substring(0, diffs[pointer + 1][1].length) == diffs[pointer + 1][1]) {
              diffs[pointer - 1][1] += diffs[pointer + 1][1];
              diffs[pointer][1] = diffs[pointer][1].substring(diffs[pointer + 1][1].length) + diffs[pointer + 1][1];
              diffs.splice(pointer + 1, 1);
              changes = true;
            }
          }
          pointer++;
        }
        if (changes) {
          diff_cleanupMerge(diffs, fix_unicode);
        }
      }
      function is_surrogate_pair_start(charCode) {
        return charCode >= 55296 && charCode <= 56319;
      }
      function is_surrogate_pair_end(charCode) {
        return charCode >= 56320 && charCode <= 57343;
      }
      function starts_with_pair_end(str) {
        return is_surrogate_pair_end(str.charCodeAt(0));
      }
      function ends_with_pair_start(str) {
        return is_surrogate_pair_start(str.charCodeAt(str.length - 1));
      }
      function remove_empty_tuples(tuples) {
        var ret = [];
        for (var i = 0; i < tuples.length; i++) {
          if (tuples[i][1].length > 0) {
            ret.push(tuples[i]);
          }
        }
        return ret;
      }
      function make_edit_splice(before, oldMiddle, newMiddle, after) {
        if (ends_with_pair_start(before) || starts_with_pair_end(after)) {
          return null;
        }
        return remove_empty_tuples([
          [DIFF_EQUAL, before],
          [DIFF_DELETE, oldMiddle],
          [DIFF_INSERT, newMiddle],
          [DIFF_EQUAL, after]
        ]);
      }
      function find_cursor_edit_diff(oldText, newText, cursor_pos) {
        var oldRange = typeof cursor_pos === "number" ? { index: cursor_pos, length: 0 } : cursor_pos.oldRange;
        var newRange = typeof cursor_pos === "number" ? null : cursor_pos.newRange;
        var oldLength = oldText.length;
        var newLength = newText.length;
        if (oldRange.length === 0 && (newRange === null || newRange.length === 0)) {
          var oldCursor = oldRange.index;
          var oldBefore = oldText.slice(0, oldCursor);
          var oldAfter = oldText.slice(oldCursor);
          var maybeNewCursor = newRange ? newRange.index : null;
          editBefore: {
            var newCursor = oldCursor + newLength - oldLength;
            if (maybeNewCursor !== null && maybeNewCursor !== newCursor) {
              break editBefore;
            }
            if (newCursor < 0 || newCursor > newLength) {
              break editBefore;
            }
            var newBefore = newText.slice(0, newCursor);
            var newAfter = newText.slice(newCursor);
            if (newAfter !== oldAfter) {
              break editBefore;
            }
            var prefixLength = Math.min(oldCursor, newCursor);
            var oldPrefix = oldBefore.slice(0, prefixLength);
            var newPrefix = newBefore.slice(0, prefixLength);
            if (oldPrefix !== newPrefix) {
              break editBefore;
            }
            var oldMiddle = oldBefore.slice(prefixLength);
            var newMiddle = newBefore.slice(prefixLength);
            return make_edit_splice(oldPrefix, oldMiddle, newMiddle, oldAfter);
          }
          editAfter: {
            if (maybeNewCursor !== null && maybeNewCursor !== oldCursor) {
              break editAfter;
            }
            var cursor = oldCursor;
            var newBefore = newText.slice(0, cursor);
            var newAfter = newText.slice(cursor);
            if (newBefore !== oldBefore) {
              break editAfter;
            }
            var suffixLength = Math.min(oldLength - cursor, newLength - cursor);
            var oldSuffix = oldAfter.slice(oldAfter.length - suffixLength);
            var newSuffix = newAfter.slice(newAfter.length - suffixLength);
            if (oldSuffix !== newSuffix) {
              break editAfter;
            }
            var oldMiddle = oldAfter.slice(0, oldAfter.length - suffixLength);
            var newMiddle = newAfter.slice(0, newAfter.length - suffixLength);
            return make_edit_splice(oldBefore, oldMiddle, newMiddle, oldSuffix);
          }
        }
        if (oldRange.length > 0 && newRange && newRange.length === 0) {
          replaceRange: {
            var oldPrefix = oldText.slice(0, oldRange.index);
            var oldSuffix = oldText.slice(oldRange.index + oldRange.length);
            var prefixLength = oldPrefix.length;
            var suffixLength = oldSuffix.length;
            if (newLength < prefixLength + suffixLength) {
              break replaceRange;
            }
            var newPrefix = newText.slice(0, prefixLength);
            var newSuffix = newText.slice(newLength - suffixLength);
            if (oldPrefix !== newPrefix || oldSuffix !== newSuffix) {
              break replaceRange;
            }
            var oldMiddle = oldText.slice(prefixLength, oldLength - suffixLength);
            var newMiddle = newText.slice(prefixLength, newLength - suffixLength);
            return make_edit_splice(oldPrefix, oldMiddle, newMiddle, oldSuffix);
          }
        }
        return null;
      }
      function diff(text1, text2, cursor_pos, cleanup) {
        return diff_main(text1, text2, cursor_pos, cleanup, true);
      }
      diff.INSERT = DIFF_INSERT;
      diff.DELETE = DIFF_DELETE;
      diff.EQUAL = DIFF_EQUAL;
      module2.exports = diff;
    }
  });

  // node_modules/lodash.clonedeep/index.js
  var require_lodash = __commonJS({
    "node_modules/lodash.clonedeep/index.js"(exports2, module2) {
      var LARGE_ARRAY_SIZE2 = 200;
      var HASH_UNDEFINED4 = "__lodash_hash_undefined__";
      var MAX_SAFE_INTEGER3 = 9007199254740991;
      var argsTag5 = "[object Arguments]";
      var arrayTag4 = "[object Array]";
      var boolTag5 = "[object Boolean]";
      var dateTag5 = "[object Date]";
      var errorTag4 = "[object Error]";
      var funcTag4 = "[object Function]";
      var genTag3 = "[object GeneratorFunction]";
      var mapTag7 = "[object Map]";
      var numberTag5 = "[object Number]";
      var objectTag6 = "[object Object]";
      var promiseTag2 = "[object Promise]";
      var regexpTag5 = "[object RegExp]";
      var setTag7 = "[object Set]";
      var stringTag5 = "[object String]";
      var symbolTag4 = "[object Symbol]";
      var weakMapTag4 = "[object WeakMap]";
      var arrayBufferTag5 = "[object ArrayBuffer]";
      var dataViewTag6 = "[object DataView]";
      var float32Tag4 = "[object Float32Array]";
      var float64Tag4 = "[object Float64Array]";
      var int8Tag4 = "[object Int8Array]";
      var int16Tag4 = "[object Int16Array]";
      var int32Tag4 = "[object Int32Array]";
      var uint8Tag4 = "[object Uint8Array]";
      var uint8ClampedTag4 = "[object Uint8ClampedArray]";
      var uint16Tag4 = "[object Uint16Array]";
      var uint32Tag4 = "[object Uint32Array]";
      var reRegExpChar2 = /[\\^$.*+?()[\]{}|]/g;
      var reFlags2 = /\w*$/;
      var reIsHostCtor2 = /^\[object .+?Constructor\]$/;
      var reIsUint2 = /^(?:0|[1-9]\d*)$/;
      var cloneableTags2 = {};
      cloneableTags2[argsTag5] = cloneableTags2[arrayTag4] = cloneableTags2[arrayBufferTag5] = cloneableTags2[dataViewTag6] = cloneableTags2[boolTag5] = cloneableTags2[dateTag5] = cloneableTags2[float32Tag4] = cloneableTags2[float64Tag4] = cloneableTags2[int8Tag4] = cloneableTags2[int16Tag4] = cloneableTags2[int32Tag4] = cloneableTags2[mapTag7] = cloneableTags2[numberTag5] = cloneableTags2[objectTag6] = cloneableTags2[regexpTag5] = cloneableTags2[setTag7] = cloneableTags2[stringTag5] = cloneableTags2[symbolTag4] = cloneableTags2[uint8Tag4] = cloneableTags2[uint8ClampedTag4] = cloneableTags2[uint16Tag4] = cloneableTags2[uint32Tag4] = true;
      cloneableTags2[errorTag4] = cloneableTags2[funcTag4] = cloneableTags2[weakMapTag4] = false;
      var freeGlobal2 = typeof global == "object" && global && global.Object === Object && global;
      var freeSelf2 = typeof self == "object" && self && self.Object === Object && self;
      var root2 = freeGlobal2 || freeSelf2 || Function("return this")();
      var freeExports4 = typeof exports2 == "object" && exports2 && !exports2.nodeType && exports2;
      var freeModule4 = freeExports4 && typeof module2 == "object" && module2 && !module2.nodeType && module2;
      var moduleExports4 = freeModule4 && freeModule4.exports === freeExports4;
      function addMapEntry(map, pair) {
        map.set(pair[0], pair[1]);
        return map;
      }
      function addSetEntry(set, value) {
        set.add(value);
        return set;
      }
      function arrayEach2(array, iteratee) {
        var index = -1, length = array ? array.length : 0;
        while (++index < length) {
          if (iteratee(array[index], index, array) === false) {
            break;
          }
        }
        return array;
      }
      function arrayPush2(array, values) {
        var index = -1, length = values.length, offset = array.length;
        while (++index < length) {
          array[offset + index] = values[index];
        }
        return array;
      }
      function arrayReduce(array, iteratee, accumulator, initAccum) {
        var index = -1, length = array ? array.length : 0;
        if (initAccum && length) {
          accumulator = array[++index];
        }
        while (++index < length) {
          accumulator = iteratee(accumulator, array[index], index, array);
        }
        return accumulator;
      }
      function baseTimes2(n, iteratee) {
        var index = -1, result = Array(n);
        while (++index < n) {
          result[index] = iteratee(index);
        }
        return result;
      }
      function getValue2(object, key) {
        return object == null ? void 0 : object[key];
      }
      function isHostObject(value) {
        var result = false;
        if (value != null && typeof value.toString != "function") {
          try {
            result = !!(value + "");
          } catch (e) {
          }
        }
        return result;
      }
      function mapToArray2(map) {
        var index = -1, result = Array(map.size);
        map.forEach(function(value, key) {
          result[++index] = [key, value];
        });
        return result;
      }
      function overArg2(func, transform) {
        return function(arg) {
          return func(transform(arg));
        };
      }
      function setToArray2(set) {
        var index = -1, result = Array(set.size);
        set.forEach(function(value) {
          result[++index] = value;
        });
        return result;
      }
      var arrayProto2 = Array.prototype;
      var funcProto4 = Function.prototype;
      var objectProto17 = Object.prototype;
      var coreJsData2 = root2["__core-js_shared__"];
      var maskSrcKey2 = function() {
        var uid = /[^.]+$/.exec(coreJsData2 && coreJsData2.keys && coreJsData2.keys.IE_PROTO || "");
        return uid ? "Symbol(src)_1." + uid : "";
      }();
      var funcToString4 = funcProto4.toString;
      var hasOwnProperty14 = objectProto17.hasOwnProperty;
      var objectToString2 = objectProto17.toString;
      var reIsNative2 = RegExp(
        "^" + funcToString4.call(hasOwnProperty14).replace(reRegExpChar2, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
      );
      var Buffer4 = moduleExports4 ? root2.Buffer : void 0;
      var Symbol3 = root2.Symbol;
      var Uint8Array3 = root2.Uint8Array;
      var getPrototype2 = overArg2(Object.getPrototypeOf, Object);
      var objectCreate2 = Object.create;
      var propertyIsEnumerable3 = objectProto17.propertyIsEnumerable;
      var splice2 = arrayProto2.splice;
      var nativeGetSymbols3 = Object.getOwnPropertySymbols;
      var nativeIsBuffer2 = Buffer4 ? Buffer4.isBuffer : void 0;
      var nativeKeys2 = overArg2(Object.keys, Object);
      var DataView2 = getNative2(root2, "DataView");
      var Map3 = getNative2(root2, "Map");
      var Promise3 = getNative2(root2, "Promise");
      var Set3 = getNative2(root2, "Set");
      var WeakMap3 = getNative2(root2, "WeakMap");
      var nativeCreate2 = getNative2(Object, "create");
      var dataViewCtorString2 = toSource2(DataView2);
      var mapCtorString2 = toSource2(Map3);
      var promiseCtorString2 = toSource2(Promise3);
      var setCtorString2 = toSource2(Set3);
      var weakMapCtorString2 = toSource2(WeakMap3);
      var symbolProto3 = Symbol3 ? Symbol3.prototype : void 0;
      var symbolValueOf3 = symbolProto3 ? symbolProto3.valueOf : void 0;
      function Hash2(entries) {
        var index = -1, length = entries ? entries.length : 0;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      function hashClear2() {
        this.__data__ = nativeCreate2 ? nativeCreate2(null) : {};
      }
      function hashDelete2(key) {
        return this.has(key) && delete this.__data__[key];
      }
      function hashGet2(key) {
        var data = this.__data__;
        if (nativeCreate2) {
          var result = data[key];
          return result === HASH_UNDEFINED4 ? void 0 : result;
        }
        return hasOwnProperty14.call(data, key) ? data[key] : void 0;
      }
      function hashHas2(key) {
        var data = this.__data__;
        return nativeCreate2 ? data[key] !== void 0 : hasOwnProperty14.call(data, key);
      }
      function hashSet2(key, value) {
        var data = this.__data__;
        data[key] = nativeCreate2 && value === void 0 ? HASH_UNDEFINED4 : value;
        return this;
      }
      Hash2.prototype.clear = hashClear2;
      Hash2.prototype["delete"] = hashDelete2;
      Hash2.prototype.get = hashGet2;
      Hash2.prototype.has = hashHas2;
      Hash2.prototype.set = hashSet2;
      function ListCache2(entries) {
        var index = -1, length = entries ? entries.length : 0;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      function listCacheClear2() {
        this.__data__ = [];
      }
      function listCacheDelete2(key) {
        var data = this.__data__, index = assocIndexOf2(data, key);
        if (index < 0) {
          return false;
        }
        var lastIndex = data.length - 1;
        if (index == lastIndex) {
          data.pop();
        } else {
          splice2.call(data, index, 1);
        }
        return true;
      }
      function listCacheGet2(key) {
        var data = this.__data__, index = assocIndexOf2(data, key);
        return index < 0 ? void 0 : data[index][1];
      }
      function listCacheHas2(key) {
        return assocIndexOf2(this.__data__, key) > -1;
      }
      function listCacheSet2(key, value) {
        var data = this.__data__, index = assocIndexOf2(data, key);
        if (index < 0) {
          data.push([key, value]);
        } else {
          data[index][1] = value;
        }
        return this;
      }
      ListCache2.prototype.clear = listCacheClear2;
      ListCache2.prototype["delete"] = listCacheDelete2;
      ListCache2.prototype.get = listCacheGet2;
      ListCache2.prototype.has = listCacheHas2;
      ListCache2.prototype.set = listCacheSet2;
      function MapCache2(entries) {
        var index = -1, length = entries ? entries.length : 0;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      function mapCacheClear2() {
        this.__data__ = {
          "hash": new Hash2(),
          "map": new (Map3 || ListCache2)(),
          "string": new Hash2()
        };
      }
      function mapCacheDelete2(key) {
        return getMapData2(this, key)["delete"](key);
      }
      function mapCacheGet2(key) {
        return getMapData2(this, key).get(key);
      }
      function mapCacheHas2(key) {
        return getMapData2(this, key).has(key);
      }
      function mapCacheSet2(key, value) {
        getMapData2(this, key).set(key, value);
        return this;
      }
      MapCache2.prototype.clear = mapCacheClear2;
      MapCache2.prototype["delete"] = mapCacheDelete2;
      MapCache2.prototype.get = mapCacheGet2;
      MapCache2.prototype.has = mapCacheHas2;
      MapCache2.prototype.set = mapCacheSet2;
      function Stack2(entries) {
        this.__data__ = new ListCache2(entries);
      }
      function stackClear2() {
        this.__data__ = new ListCache2();
      }
      function stackDelete2(key) {
        return this.__data__["delete"](key);
      }
      function stackGet2(key) {
        return this.__data__.get(key);
      }
      function stackHas2(key) {
        return this.__data__.has(key);
      }
      function stackSet2(key, value) {
        var cache = this.__data__;
        if (cache instanceof ListCache2) {
          var pairs = cache.__data__;
          if (!Map3 || pairs.length < LARGE_ARRAY_SIZE2 - 1) {
            pairs.push([key, value]);
            return this;
          }
          cache = this.__data__ = new MapCache2(pairs);
        }
        cache.set(key, value);
        return this;
      }
      Stack2.prototype.clear = stackClear2;
      Stack2.prototype["delete"] = stackDelete2;
      Stack2.prototype.get = stackGet2;
      Stack2.prototype.has = stackHas2;
      Stack2.prototype.set = stackSet2;
      function arrayLikeKeys2(value, inherited) {
        var result = isArray2(value) || isArguments2(value) ? baseTimes2(value.length, String) : [];
        var length = result.length, skipIndexes = !!length;
        for (var key in value) {
          if ((inherited || hasOwnProperty14.call(value, key)) && !(skipIndexes && (key == "length" || isIndex2(key, length)))) {
            result.push(key);
          }
        }
        return result;
      }
      function assignValue2(object, key, value) {
        var objValue = object[key];
        if (!(hasOwnProperty14.call(object, key) && eq2(objValue, value)) || value === void 0 && !(key in object)) {
          object[key] = value;
        }
      }
      function assocIndexOf2(array, key) {
        var length = array.length;
        while (length--) {
          if (eq2(array[length][0], key)) {
            return length;
          }
        }
        return -1;
      }
      function baseAssign2(object, source) {
        return object && copyObject2(source, keys2(source), object);
      }
      function baseClone2(value, isDeep, isFull, customizer, key, object, stack) {
        var result;
        if (customizer) {
          result = object ? customizer(value, key, object, stack) : customizer(value);
        }
        if (result !== void 0) {
          return result;
        }
        if (!isObject2(value)) {
          return value;
        }
        var isArr = isArray2(value);
        if (isArr) {
          result = initCloneArray2(value);
          if (!isDeep) {
            return copyArray2(value, result);
          }
        } else {
          var tag = getTag2(value), isFunc = tag == funcTag4 || tag == genTag3;
          if (isBuffer2(value)) {
            return cloneBuffer2(value, isDeep);
          }
          if (tag == objectTag6 || tag == argsTag5 || isFunc && !object) {
            if (isHostObject(value)) {
              return object ? value : {};
            }
            result = initCloneObject2(isFunc ? {} : value);
            if (!isDeep) {
              return copySymbols2(value, baseAssign2(result, value));
            }
          } else {
            if (!cloneableTags2[tag]) {
              return object ? value : {};
            }
            result = initCloneByTag2(value, tag, baseClone2, isDeep);
          }
        }
        stack || (stack = new Stack2());
        var stacked = stack.get(value);
        if (stacked) {
          return stacked;
        }
        stack.set(value, result);
        if (!isArr) {
          var props = isFull ? getAllKeys2(value) : keys2(value);
        }
        arrayEach2(props || value, function(subValue, key2) {
          if (props) {
            key2 = subValue;
            subValue = value[key2];
          }
          assignValue2(result, key2, baseClone2(subValue, isDeep, isFull, customizer, key2, value, stack));
        });
        return result;
      }
      function baseCreate2(proto) {
        return isObject2(proto) ? objectCreate2(proto) : {};
      }
      function baseGetAllKeys2(object, keysFunc, symbolsFunc) {
        var result = keysFunc(object);
        return isArray2(object) ? result : arrayPush2(result, symbolsFunc(object));
      }
      function baseGetTag2(value) {
        return objectToString2.call(value);
      }
      function baseIsNative2(value) {
        if (!isObject2(value) || isMasked2(value)) {
          return false;
        }
        var pattern = isFunction2(value) || isHostObject(value) ? reIsNative2 : reIsHostCtor2;
        return pattern.test(toSource2(value));
      }
      function baseKeys2(object) {
        if (!isPrototype2(object)) {
          return nativeKeys2(object);
        }
        var result = [];
        for (var key in Object(object)) {
          if (hasOwnProperty14.call(object, key) && key != "constructor") {
            result.push(key);
          }
        }
        return result;
      }
      function cloneBuffer2(buffer, isDeep) {
        if (isDeep) {
          return buffer.slice();
        }
        var result = new buffer.constructor(buffer.length);
        buffer.copy(result);
        return result;
      }
      function cloneArrayBuffer2(arrayBuffer) {
        var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
        new Uint8Array3(result).set(new Uint8Array3(arrayBuffer));
        return result;
      }
      function cloneDataView2(dataView, isDeep) {
        var buffer = isDeep ? cloneArrayBuffer2(dataView.buffer) : dataView.buffer;
        return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
      }
      function cloneMap(map, isDeep, cloneFunc) {
        var array = isDeep ? cloneFunc(mapToArray2(map), true) : mapToArray2(map);
        return arrayReduce(array, addMapEntry, new map.constructor());
      }
      function cloneRegExp2(regexp) {
        var result = new regexp.constructor(regexp.source, reFlags2.exec(regexp));
        result.lastIndex = regexp.lastIndex;
        return result;
      }
      function cloneSet(set, isDeep, cloneFunc) {
        var array = isDeep ? cloneFunc(setToArray2(set), true) : setToArray2(set);
        return arrayReduce(array, addSetEntry, new set.constructor());
      }
      function cloneSymbol2(symbol) {
        return symbolValueOf3 ? Object(symbolValueOf3.call(symbol)) : {};
      }
      function cloneTypedArray2(typedArray, isDeep) {
        var buffer = isDeep ? cloneArrayBuffer2(typedArray.buffer) : typedArray.buffer;
        return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
      }
      function copyArray2(source, array) {
        var index = -1, length = source.length;
        array || (array = Array(length));
        while (++index < length) {
          array[index] = source[index];
        }
        return array;
      }
      function copyObject2(source, props, object, customizer) {
        object || (object = {});
        var index = -1, length = props.length;
        while (++index < length) {
          var key = props[index];
          var newValue = customizer ? customizer(object[key], source[key], key, object, source) : void 0;
          assignValue2(object, key, newValue === void 0 ? source[key] : newValue);
        }
        return object;
      }
      function copySymbols2(source, object) {
        return copyObject2(source, getSymbols2(source), object);
      }
      function getAllKeys2(object) {
        return baseGetAllKeys2(object, keys2, getSymbols2);
      }
      function getMapData2(map, key) {
        var data = map.__data__;
        return isKeyable2(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
      }
      function getNative2(object, key) {
        var value = getValue2(object, key);
        return baseIsNative2(value) ? value : void 0;
      }
      var getSymbols2 = nativeGetSymbols3 ? overArg2(nativeGetSymbols3, Object) : stubArray2;
      var getTag2 = baseGetTag2;
      if (DataView2 && getTag2(new DataView2(new ArrayBuffer(1))) != dataViewTag6 || Map3 && getTag2(new Map3()) != mapTag7 || Promise3 && getTag2(Promise3.resolve()) != promiseTag2 || Set3 && getTag2(new Set3()) != setTag7 || WeakMap3 && getTag2(new WeakMap3()) != weakMapTag4) {
        getTag2 = function(value) {
          var result = objectToString2.call(value), Ctor = result == objectTag6 ? value.constructor : void 0, ctorString = Ctor ? toSource2(Ctor) : void 0;
          if (ctorString) {
            switch (ctorString) {
              case dataViewCtorString2:
                return dataViewTag6;
              case mapCtorString2:
                return mapTag7;
              case promiseCtorString2:
                return promiseTag2;
              case setCtorString2:
                return setTag7;
              case weakMapCtorString2:
                return weakMapTag4;
            }
          }
          return result;
        };
      }
      function initCloneArray2(array) {
        var length = array.length, result = array.constructor(length);
        if (length && typeof array[0] == "string" && hasOwnProperty14.call(array, "index")) {
          result.index = array.index;
          result.input = array.input;
        }
        return result;
      }
      function initCloneObject2(object) {
        return typeof object.constructor == "function" && !isPrototype2(object) ? baseCreate2(getPrototype2(object)) : {};
      }
      function initCloneByTag2(object, tag, cloneFunc, isDeep) {
        var Ctor = object.constructor;
        switch (tag) {
          case arrayBufferTag5:
            return cloneArrayBuffer2(object);
          case boolTag5:
          case dateTag5:
            return new Ctor(+object);
          case dataViewTag6:
            return cloneDataView2(object, isDeep);
          case float32Tag4:
          case float64Tag4:
          case int8Tag4:
          case int16Tag4:
          case int32Tag4:
          case uint8Tag4:
          case uint8ClampedTag4:
          case uint16Tag4:
          case uint32Tag4:
            return cloneTypedArray2(object, isDeep);
          case mapTag7:
            return cloneMap(object, isDeep, cloneFunc);
          case numberTag5:
          case stringTag5:
            return new Ctor(object);
          case regexpTag5:
            return cloneRegExp2(object);
          case setTag7:
            return cloneSet(object, isDeep, cloneFunc);
          case symbolTag4:
            return cloneSymbol2(object);
        }
      }
      function isIndex2(value, length) {
        length = length == null ? MAX_SAFE_INTEGER3 : length;
        return !!length && (typeof value == "number" || reIsUint2.test(value)) && (value > -1 && value % 1 == 0 && value < length);
      }
      function isKeyable2(value) {
        var type = typeof value;
        return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
      }
      function isMasked2(func) {
        return !!maskSrcKey2 && maskSrcKey2 in func;
      }
      function isPrototype2(value) {
        var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto17;
        return value === proto;
      }
      function toSource2(func) {
        if (func != null) {
          try {
            return funcToString4.call(func);
          } catch (e) {
          }
          try {
            return func + "";
          } catch (e) {
          }
        }
        return "";
      }
      function cloneDeep2(value) {
        return baseClone2(value, true, true);
      }
      function eq2(value, other) {
        return value === other || value !== value && other !== other;
      }
      function isArguments2(value) {
        return isArrayLikeObject2(value) && hasOwnProperty14.call(value, "callee") && (!propertyIsEnumerable3.call(value, "callee") || objectToString2.call(value) == argsTag5);
      }
      var isArray2 = Array.isArray;
      function isArrayLike2(value) {
        return value != null && isLength2(value.length) && !isFunction2(value);
      }
      function isArrayLikeObject2(value) {
        return isObjectLike2(value) && isArrayLike2(value);
      }
      var isBuffer2 = nativeIsBuffer2 || stubFalse2;
      function isFunction2(value) {
        var tag = isObject2(value) ? objectToString2.call(value) : "";
        return tag == funcTag4 || tag == genTag3;
      }
      function isLength2(value) {
        return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER3;
      }
      function isObject2(value) {
        var type = typeof value;
        return !!value && (type == "object" || type == "function");
      }
      function isObjectLike2(value) {
        return !!value && typeof value == "object";
      }
      function keys2(object) {
        return isArrayLike2(object) ? arrayLikeKeys2(object) : baseKeys2(object);
      }
      function stubArray2() {
        return [];
      }
      function stubFalse2() {
        return false;
      }
      module2.exports = cloneDeep2;
    }
  });

  // node_modules/lodash.isequal/index.js
  var require_lodash2 = __commonJS({
    "node_modules/lodash.isequal/index.js"(exports2, module2) {
      var LARGE_ARRAY_SIZE2 = 200;
      var HASH_UNDEFINED4 = "__lodash_hash_undefined__";
      var COMPARE_PARTIAL_FLAG5 = 1;
      var COMPARE_UNORDERED_FLAG3 = 2;
      var MAX_SAFE_INTEGER3 = 9007199254740991;
      var argsTag5 = "[object Arguments]";
      var arrayTag4 = "[object Array]";
      var asyncTag2 = "[object AsyncFunction]";
      var boolTag5 = "[object Boolean]";
      var dateTag5 = "[object Date]";
      var errorTag4 = "[object Error]";
      var funcTag4 = "[object Function]";
      var genTag3 = "[object GeneratorFunction]";
      var mapTag7 = "[object Map]";
      var numberTag5 = "[object Number]";
      var nullTag2 = "[object Null]";
      var objectTag6 = "[object Object]";
      var promiseTag2 = "[object Promise]";
      var proxyTag2 = "[object Proxy]";
      var regexpTag5 = "[object RegExp]";
      var setTag7 = "[object Set]";
      var stringTag5 = "[object String]";
      var symbolTag4 = "[object Symbol]";
      var undefinedTag2 = "[object Undefined]";
      var weakMapTag4 = "[object WeakMap]";
      var arrayBufferTag5 = "[object ArrayBuffer]";
      var dataViewTag6 = "[object DataView]";
      var float32Tag4 = "[object Float32Array]";
      var float64Tag4 = "[object Float64Array]";
      var int8Tag4 = "[object Int8Array]";
      var int16Tag4 = "[object Int16Array]";
      var int32Tag4 = "[object Int32Array]";
      var uint8Tag4 = "[object Uint8Array]";
      var uint8ClampedTag4 = "[object Uint8ClampedArray]";
      var uint16Tag4 = "[object Uint16Array]";
      var uint32Tag4 = "[object Uint32Array]";
      var reRegExpChar2 = /[\\^$.*+?()[\]{}|]/g;
      var reIsHostCtor2 = /^\[object .+?Constructor\]$/;
      var reIsUint2 = /^(?:0|[1-9]\d*)$/;
      var typedArrayTags2 = {};
      typedArrayTags2[float32Tag4] = typedArrayTags2[float64Tag4] = typedArrayTags2[int8Tag4] = typedArrayTags2[int16Tag4] = typedArrayTags2[int32Tag4] = typedArrayTags2[uint8Tag4] = typedArrayTags2[uint8ClampedTag4] = typedArrayTags2[uint16Tag4] = typedArrayTags2[uint32Tag4] = true;
      typedArrayTags2[argsTag5] = typedArrayTags2[arrayTag4] = typedArrayTags2[arrayBufferTag5] = typedArrayTags2[boolTag5] = typedArrayTags2[dataViewTag6] = typedArrayTags2[dateTag5] = typedArrayTags2[errorTag4] = typedArrayTags2[funcTag4] = typedArrayTags2[mapTag7] = typedArrayTags2[numberTag5] = typedArrayTags2[objectTag6] = typedArrayTags2[regexpTag5] = typedArrayTags2[setTag7] = typedArrayTags2[stringTag5] = typedArrayTags2[weakMapTag4] = false;
      var freeGlobal2 = typeof global == "object" && global && global.Object === Object && global;
      var freeSelf2 = typeof self == "object" && self && self.Object === Object && self;
      var root2 = freeGlobal2 || freeSelf2 || Function("return this")();
      var freeExports4 = typeof exports2 == "object" && exports2 && !exports2.nodeType && exports2;
      var freeModule4 = freeExports4 && typeof module2 == "object" && module2 && !module2.nodeType && module2;
      var moduleExports4 = freeModule4 && freeModule4.exports === freeExports4;
      var freeProcess2 = moduleExports4 && freeGlobal2.process;
      var nodeUtil2 = function() {
        try {
          return freeProcess2 && freeProcess2.binding && freeProcess2.binding("util");
        } catch (e) {
        }
      }();
      var nodeIsTypedArray2 = nodeUtil2 && nodeUtil2.isTypedArray;
      function arrayFilter2(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
        while (++index < length) {
          var value = array[index];
          if (predicate(value, index, array)) {
            result[resIndex++] = value;
          }
        }
        return result;
      }
      function arrayPush2(array, values) {
        var index = -1, length = values.length, offset = array.length;
        while (++index < length) {
          array[offset + index] = values[index];
        }
        return array;
      }
      function arraySome2(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (predicate(array[index], index, array)) {
            return true;
          }
        }
        return false;
      }
      function baseTimes2(n, iteratee) {
        var index = -1, result = Array(n);
        while (++index < n) {
          result[index] = iteratee(index);
        }
        return result;
      }
      function baseUnary2(func) {
        return function(value) {
          return func(value);
        };
      }
      function cacheHas2(cache, key) {
        return cache.has(key);
      }
      function getValue2(object, key) {
        return object == null ? void 0 : object[key];
      }
      function mapToArray2(map) {
        var index = -1, result = Array(map.size);
        map.forEach(function(value, key) {
          result[++index] = [key, value];
        });
        return result;
      }
      function overArg2(func, transform) {
        return function(arg) {
          return func(transform(arg));
        };
      }
      function setToArray2(set) {
        var index = -1, result = Array(set.size);
        set.forEach(function(value) {
          result[++index] = value;
        });
        return result;
      }
      var arrayProto2 = Array.prototype;
      var funcProto4 = Function.prototype;
      var objectProto17 = Object.prototype;
      var coreJsData2 = root2["__core-js_shared__"];
      var funcToString4 = funcProto4.toString;
      var hasOwnProperty14 = objectProto17.hasOwnProperty;
      var maskSrcKey2 = function() {
        var uid = /[^.]+$/.exec(coreJsData2 && coreJsData2.keys && coreJsData2.keys.IE_PROTO || "");
        return uid ? "Symbol(src)_1." + uid : "";
      }();
      var nativeObjectToString3 = objectProto17.toString;
      var reIsNative2 = RegExp(
        "^" + funcToString4.call(hasOwnProperty14).replace(reRegExpChar2, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
      );
      var Buffer4 = moduleExports4 ? root2.Buffer : void 0;
      var Symbol3 = root2.Symbol;
      var Uint8Array3 = root2.Uint8Array;
      var propertyIsEnumerable3 = objectProto17.propertyIsEnumerable;
      var splice2 = arrayProto2.splice;
      var symToStringTag3 = Symbol3 ? Symbol3.toStringTag : void 0;
      var nativeGetSymbols3 = Object.getOwnPropertySymbols;
      var nativeIsBuffer2 = Buffer4 ? Buffer4.isBuffer : void 0;
      var nativeKeys2 = overArg2(Object.keys, Object);
      var DataView2 = getNative2(root2, "DataView");
      var Map3 = getNative2(root2, "Map");
      var Promise3 = getNative2(root2, "Promise");
      var Set3 = getNative2(root2, "Set");
      var WeakMap3 = getNative2(root2, "WeakMap");
      var nativeCreate2 = getNative2(Object, "create");
      var dataViewCtorString2 = toSource2(DataView2);
      var mapCtorString2 = toSource2(Map3);
      var promiseCtorString2 = toSource2(Promise3);
      var setCtorString2 = toSource2(Set3);
      var weakMapCtorString2 = toSource2(WeakMap3);
      var symbolProto3 = Symbol3 ? Symbol3.prototype : void 0;
      var symbolValueOf3 = symbolProto3 ? symbolProto3.valueOf : void 0;
      function Hash2(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      function hashClear2() {
        this.__data__ = nativeCreate2 ? nativeCreate2(null) : {};
        this.size = 0;
      }
      function hashDelete2(key) {
        var result = this.has(key) && delete this.__data__[key];
        this.size -= result ? 1 : 0;
        return result;
      }
      function hashGet2(key) {
        var data = this.__data__;
        if (nativeCreate2) {
          var result = data[key];
          return result === HASH_UNDEFINED4 ? void 0 : result;
        }
        return hasOwnProperty14.call(data, key) ? data[key] : void 0;
      }
      function hashHas2(key) {
        var data = this.__data__;
        return nativeCreate2 ? data[key] !== void 0 : hasOwnProperty14.call(data, key);
      }
      function hashSet2(key, value) {
        var data = this.__data__;
        this.size += this.has(key) ? 0 : 1;
        data[key] = nativeCreate2 && value === void 0 ? HASH_UNDEFINED4 : value;
        return this;
      }
      Hash2.prototype.clear = hashClear2;
      Hash2.prototype["delete"] = hashDelete2;
      Hash2.prototype.get = hashGet2;
      Hash2.prototype.has = hashHas2;
      Hash2.prototype.set = hashSet2;
      function ListCache2(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      function listCacheClear2() {
        this.__data__ = [];
        this.size = 0;
      }
      function listCacheDelete2(key) {
        var data = this.__data__, index = assocIndexOf2(data, key);
        if (index < 0) {
          return false;
        }
        var lastIndex = data.length - 1;
        if (index == lastIndex) {
          data.pop();
        } else {
          splice2.call(data, index, 1);
        }
        --this.size;
        return true;
      }
      function listCacheGet2(key) {
        var data = this.__data__, index = assocIndexOf2(data, key);
        return index < 0 ? void 0 : data[index][1];
      }
      function listCacheHas2(key) {
        return assocIndexOf2(this.__data__, key) > -1;
      }
      function listCacheSet2(key, value) {
        var data = this.__data__, index = assocIndexOf2(data, key);
        if (index < 0) {
          ++this.size;
          data.push([key, value]);
        } else {
          data[index][1] = value;
        }
        return this;
      }
      ListCache2.prototype.clear = listCacheClear2;
      ListCache2.prototype["delete"] = listCacheDelete2;
      ListCache2.prototype.get = listCacheGet2;
      ListCache2.prototype.has = listCacheHas2;
      ListCache2.prototype.set = listCacheSet2;
      function MapCache2(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
          this.set(entry[0], entry[1]);
        }
      }
      function mapCacheClear2() {
        this.size = 0;
        this.__data__ = {
          "hash": new Hash2(),
          "map": new (Map3 || ListCache2)(),
          "string": new Hash2()
        };
      }
      function mapCacheDelete2(key) {
        var result = getMapData2(this, key)["delete"](key);
        this.size -= result ? 1 : 0;
        return result;
      }
      function mapCacheGet2(key) {
        return getMapData2(this, key).get(key);
      }
      function mapCacheHas2(key) {
        return getMapData2(this, key).has(key);
      }
      function mapCacheSet2(key, value) {
        var data = getMapData2(this, key), size = data.size;
        data.set(key, value);
        this.size += data.size == size ? 0 : 1;
        return this;
      }
      MapCache2.prototype.clear = mapCacheClear2;
      MapCache2.prototype["delete"] = mapCacheDelete2;
      MapCache2.prototype.get = mapCacheGet2;
      MapCache2.prototype.has = mapCacheHas2;
      MapCache2.prototype.set = mapCacheSet2;
      function SetCache2(values) {
        var index = -1, length = values == null ? 0 : values.length;
        this.__data__ = new MapCache2();
        while (++index < length) {
          this.add(values[index]);
        }
      }
      function setCacheAdd2(value) {
        this.__data__.set(value, HASH_UNDEFINED4);
        return this;
      }
      function setCacheHas2(value) {
        return this.__data__.has(value);
      }
      SetCache2.prototype.add = SetCache2.prototype.push = setCacheAdd2;
      SetCache2.prototype.has = setCacheHas2;
      function Stack2(entries) {
        var data = this.__data__ = new ListCache2(entries);
        this.size = data.size;
      }
      function stackClear2() {
        this.__data__ = new ListCache2();
        this.size = 0;
      }
      function stackDelete2(key) {
        var data = this.__data__, result = data["delete"](key);
        this.size = data.size;
        return result;
      }
      function stackGet2(key) {
        return this.__data__.get(key);
      }
      function stackHas2(key) {
        return this.__data__.has(key);
      }
      function stackSet2(key, value) {
        var data = this.__data__;
        if (data instanceof ListCache2) {
          var pairs = data.__data__;
          if (!Map3 || pairs.length < LARGE_ARRAY_SIZE2 - 1) {
            pairs.push([key, value]);
            this.size = ++data.size;
            return this;
          }
          data = this.__data__ = new MapCache2(pairs);
        }
        data.set(key, value);
        this.size = data.size;
        return this;
      }
      Stack2.prototype.clear = stackClear2;
      Stack2.prototype["delete"] = stackDelete2;
      Stack2.prototype.get = stackGet2;
      Stack2.prototype.has = stackHas2;
      Stack2.prototype.set = stackSet2;
      function arrayLikeKeys2(value, inherited) {
        var isArr = isArray2(value), isArg = !isArr && isArguments2(value), isBuff = !isArr && !isArg && isBuffer2(value), isType = !isArr && !isArg && !isBuff && isTypedArray2(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes2(value.length, String) : [], length = result.length;
        for (var key in value) {
          if ((inherited || hasOwnProperty14.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
          (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
          isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
          isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
          isIndex2(key, length)))) {
            result.push(key);
          }
        }
        return result;
      }
      function assocIndexOf2(array, key) {
        var length = array.length;
        while (length--) {
          if (eq2(array[length][0], key)) {
            return length;
          }
        }
        return -1;
      }
      function baseGetAllKeys2(object, keysFunc, symbolsFunc) {
        var result = keysFunc(object);
        return isArray2(object) ? result : arrayPush2(result, symbolsFunc(object));
      }
      function baseGetTag2(value) {
        if (value == null) {
          return value === void 0 ? undefinedTag2 : nullTag2;
        }
        return symToStringTag3 && symToStringTag3 in Object(value) ? getRawTag2(value) : objectToString2(value);
      }
      function baseIsArguments2(value) {
        return isObjectLike2(value) && baseGetTag2(value) == argsTag5;
      }
      function baseIsEqual2(value, other, bitmask, customizer, stack) {
        if (value === other) {
          return true;
        }
        if (value == null || other == null || !isObjectLike2(value) && !isObjectLike2(other)) {
          return value !== value && other !== other;
        }
        return baseIsEqualDeep2(value, other, bitmask, customizer, baseIsEqual2, stack);
      }
      function baseIsEqualDeep2(object, other, bitmask, customizer, equalFunc, stack) {
        var objIsArr = isArray2(object), othIsArr = isArray2(other), objTag = objIsArr ? arrayTag4 : getTag2(object), othTag = othIsArr ? arrayTag4 : getTag2(other);
        objTag = objTag == argsTag5 ? objectTag6 : objTag;
        othTag = othTag == argsTag5 ? objectTag6 : othTag;
        var objIsObj = objTag == objectTag6, othIsObj = othTag == objectTag6, isSameTag = objTag == othTag;
        if (isSameTag && isBuffer2(object)) {
          if (!isBuffer2(other)) {
            return false;
          }
          objIsArr = true;
          objIsObj = false;
        }
        if (isSameTag && !objIsObj) {
          stack || (stack = new Stack2());
          return objIsArr || isTypedArray2(object) ? equalArrays2(object, other, bitmask, customizer, equalFunc, stack) : equalByTag2(object, other, objTag, bitmask, customizer, equalFunc, stack);
        }
        if (!(bitmask & COMPARE_PARTIAL_FLAG5)) {
          var objIsWrapped = objIsObj && hasOwnProperty14.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty14.call(other, "__wrapped__");
          if (objIsWrapped || othIsWrapped) {
            var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
            stack || (stack = new Stack2());
            return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
          }
        }
        if (!isSameTag) {
          return false;
        }
        stack || (stack = new Stack2());
        return equalObjects2(object, other, bitmask, customizer, equalFunc, stack);
      }
      function baseIsNative2(value) {
        if (!isObject2(value) || isMasked2(value)) {
          return false;
        }
        var pattern = isFunction2(value) ? reIsNative2 : reIsHostCtor2;
        return pattern.test(toSource2(value));
      }
      function baseIsTypedArray2(value) {
        return isObjectLike2(value) && isLength2(value.length) && !!typedArrayTags2[baseGetTag2(value)];
      }
      function baseKeys2(object) {
        if (!isPrototype2(object)) {
          return nativeKeys2(object);
        }
        var result = [];
        for (var key in Object(object)) {
          if (hasOwnProperty14.call(object, key) && key != "constructor") {
            result.push(key);
          }
        }
        return result;
      }
      function equalArrays2(array, other, bitmask, customizer, equalFunc, stack) {
        var isPartial = bitmask & COMPARE_PARTIAL_FLAG5, arrLength = array.length, othLength = other.length;
        if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
          return false;
        }
        var stacked = stack.get(array);
        if (stacked && stack.get(other)) {
          return stacked == other;
        }
        var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG3 ? new SetCache2() : void 0;
        stack.set(array, other);
        stack.set(other, array);
        while (++index < arrLength) {
          var arrValue = array[index], othValue = other[index];
          if (customizer) {
            var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
          }
          if (compared !== void 0) {
            if (compared) {
              continue;
            }
            result = false;
            break;
          }
          if (seen) {
            if (!arraySome2(other, function(othValue2, othIndex) {
              if (!cacheHas2(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
                return seen.push(othIndex);
              }
            })) {
              result = false;
              break;
            }
          } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
            result = false;
            break;
          }
        }
        stack["delete"](array);
        stack["delete"](other);
        return result;
      }
      function equalByTag2(object, other, tag, bitmask, customizer, equalFunc, stack) {
        switch (tag) {
          case dataViewTag6:
            if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
              return false;
            }
            object = object.buffer;
            other = other.buffer;
          case arrayBufferTag5:
            if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array3(object), new Uint8Array3(other))) {
              return false;
            }
            return true;
          case boolTag5:
          case dateTag5:
          case numberTag5:
            return eq2(+object, +other);
          case errorTag4:
            return object.name == other.name && object.message == other.message;
          case regexpTag5:
          case stringTag5:
            return object == other + "";
          case mapTag7:
            var convert = mapToArray2;
          case setTag7:
            var isPartial = bitmask & COMPARE_PARTIAL_FLAG5;
            convert || (convert = setToArray2);
            if (object.size != other.size && !isPartial) {
              return false;
            }
            var stacked = stack.get(object);
            if (stacked) {
              return stacked == other;
            }
            bitmask |= COMPARE_UNORDERED_FLAG3;
            stack.set(object, other);
            var result = equalArrays2(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
            stack["delete"](object);
            return result;
          case symbolTag4:
            if (symbolValueOf3) {
              return symbolValueOf3.call(object) == symbolValueOf3.call(other);
            }
        }
        return false;
      }
      function equalObjects2(object, other, bitmask, customizer, equalFunc, stack) {
        var isPartial = bitmask & COMPARE_PARTIAL_FLAG5, objProps = getAllKeys2(object), objLength = objProps.length, othProps = getAllKeys2(other), othLength = othProps.length;
        if (objLength != othLength && !isPartial) {
          return false;
        }
        var index = objLength;
        while (index--) {
          var key = objProps[index];
          if (!(isPartial ? key in other : hasOwnProperty14.call(other, key))) {
            return false;
          }
        }
        var stacked = stack.get(object);
        if (stacked && stack.get(other)) {
          return stacked == other;
        }
        var result = true;
        stack.set(object, other);
        stack.set(other, object);
        var skipCtor = isPartial;
        while (++index < objLength) {
          key = objProps[index];
          var objValue = object[key], othValue = other[key];
          if (customizer) {
            var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
          }
          if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
            result = false;
            break;
          }
          skipCtor || (skipCtor = key == "constructor");
        }
        if (result && !skipCtor) {
          var objCtor = object.constructor, othCtor = other.constructor;
          if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
            result = false;
          }
        }
        stack["delete"](object);
        stack["delete"](other);
        return result;
      }
      function getAllKeys2(object) {
        return baseGetAllKeys2(object, keys2, getSymbols2);
      }
      function getMapData2(map, key) {
        var data = map.__data__;
        return isKeyable2(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
      }
      function getNative2(object, key) {
        var value = getValue2(object, key);
        return baseIsNative2(value) ? value : void 0;
      }
      function getRawTag2(value) {
        var isOwn = hasOwnProperty14.call(value, symToStringTag3), tag = value[symToStringTag3];
        try {
          value[symToStringTag3] = void 0;
          var unmasked = true;
        } catch (e) {
        }
        var result = nativeObjectToString3.call(value);
        if (unmasked) {
          if (isOwn) {
            value[symToStringTag3] = tag;
          } else {
            delete value[symToStringTag3];
          }
        }
        return result;
      }
      var getSymbols2 = !nativeGetSymbols3 ? stubArray2 : function(object) {
        if (object == null) {
          return [];
        }
        object = Object(object);
        return arrayFilter2(nativeGetSymbols3(object), function(symbol) {
          return propertyIsEnumerable3.call(object, symbol);
        });
      };
      var getTag2 = baseGetTag2;
      if (DataView2 && getTag2(new DataView2(new ArrayBuffer(1))) != dataViewTag6 || Map3 && getTag2(new Map3()) != mapTag7 || Promise3 && getTag2(Promise3.resolve()) != promiseTag2 || Set3 && getTag2(new Set3()) != setTag7 || WeakMap3 && getTag2(new WeakMap3()) != weakMapTag4) {
        getTag2 = function(value) {
          var result = baseGetTag2(value), Ctor = result == objectTag6 ? value.constructor : void 0, ctorString = Ctor ? toSource2(Ctor) : "";
          if (ctorString) {
            switch (ctorString) {
              case dataViewCtorString2:
                return dataViewTag6;
              case mapCtorString2:
                return mapTag7;
              case promiseCtorString2:
                return promiseTag2;
              case setCtorString2:
                return setTag7;
              case weakMapCtorString2:
                return weakMapTag4;
            }
          }
          return result;
        };
      }
      function isIndex2(value, length) {
        length = length == null ? MAX_SAFE_INTEGER3 : length;
        return !!length && (typeof value == "number" || reIsUint2.test(value)) && (value > -1 && value % 1 == 0 && value < length);
      }
      function isKeyable2(value) {
        var type = typeof value;
        return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
      }
      function isMasked2(func) {
        return !!maskSrcKey2 && maskSrcKey2 in func;
      }
      function isPrototype2(value) {
        var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto17;
        return value === proto;
      }
      function objectToString2(value) {
        return nativeObjectToString3.call(value);
      }
      function toSource2(func) {
        if (func != null) {
          try {
            return funcToString4.call(func);
          } catch (e) {
          }
          try {
            return func + "";
          } catch (e) {
          }
        }
        return "";
      }
      function eq2(value, other) {
        return value === other || value !== value && other !== other;
      }
      var isArguments2 = baseIsArguments2(/* @__PURE__ */ function() {
        return arguments;
      }()) ? baseIsArguments2 : function(value) {
        return isObjectLike2(value) && hasOwnProperty14.call(value, "callee") && !propertyIsEnumerable3.call(value, "callee");
      };
      var isArray2 = Array.isArray;
      function isArrayLike2(value) {
        return value != null && isLength2(value.length) && !isFunction2(value);
      }
      var isBuffer2 = nativeIsBuffer2 || stubFalse2;
      function isEqual3(value, other) {
        return baseIsEqual2(value, other);
      }
      function isFunction2(value) {
        if (!isObject2(value)) {
          return false;
        }
        var tag = baseGetTag2(value);
        return tag == funcTag4 || tag == genTag3 || tag == asyncTag2 || tag == proxyTag2;
      }
      function isLength2(value) {
        return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER3;
      }
      function isObject2(value) {
        var type = typeof value;
        return value != null && (type == "object" || type == "function");
      }
      function isObjectLike2(value) {
        return value != null && typeof value == "object";
      }
      var isTypedArray2 = nodeIsTypedArray2 ? baseUnary2(nodeIsTypedArray2) : baseIsTypedArray2;
      function keys2(object) {
        return isArrayLike2(object) ? arrayLikeKeys2(object) : baseKeys2(object);
      }
      function stubArray2() {
        return [];
      }
      function stubFalse2() {
        return false;
      }
      module2.exports = isEqual3;
    }
  });

  // node_modules/quill-delta/dist/AttributeMap.js
  var require_AttributeMap = __commonJS({
    "node_modules/quill-delta/dist/AttributeMap.js"(exports2) {
      "use strict";
      Object.defineProperty(exports2, "__esModule", { value: true });
      var cloneDeep2 = require_lodash();
      var isEqual3 = require_lodash2();
      var AttributeMap5;
      (function(AttributeMap6) {
        function compose(a = {}, b = {}, keepNull = false) {
          if (typeof a !== "object") {
            a = {};
          }
          if (typeof b !== "object") {
            b = {};
          }
          let attributes = cloneDeep2(b);
          if (!keepNull) {
            attributes = Object.keys(attributes).reduce((copy, key) => {
              if (attributes[key] != null) {
                copy[key] = attributes[key];
              }
              return copy;
            }, {});
          }
          for (const key in a) {
            if (a[key] !== void 0 && b[key] === void 0) {
              attributes[key] = a[key];
            }
          }
          return Object.keys(attributes).length > 0 ? attributes : void 0;
        }
        AttributeMap6.compose = compose;
        function diff(a = {}, b = {}) {
          if (typeof a !== "object") {
            a = {};
          }
          if (typeof b !== "object") {
            b = {};
          }
          const attributes = Object.keys(a).concat(Object.keys(b)).reduce((attrs, key) => {
            if (!isEqual3(a[key], b[key])) {
              attrs[key] = b[key] === void 0 ? null : b[key];
            }
            return attrs;
          }, {});
          return Object.keys(attributes).length > 0 ? attributes : void 0;
        }
        AttributeMap6.diff = diff;
        function invert(attr = {}, base = {}) {
          attr = attr || {};
          const baseInverted = Object.keys(base).reduce((memo, key) => {
            if (base[key] !== attr[key] && attr[key] !== void 0) {
              memo[key] = base[key];
            }
            return memo;
          }, {});
          return Object.keys(attr).reduce((memo, key) => {
            if (attr[key] !== base[key] && base[key] === void 0) {
              memo[key] = null;
            }
            return memo;
          }, baseInverted);
        }
        AttributeMap6.invert = invert;
        function transform(a, b, priority = false) {
          if (typeof a !== "object") {
            return b;
          }
          if (typeof b !== "object") {
            return void 0;
          }
          if (!priority) {
            return b;
          }
          const attributes = Object.keys(b).reduce((attrs, key) => {
            if (a[key] === void 0) {
              attrs[key] = b[key];
            }
            return attrs;
          }, {});
          return Object.keys(attributes).length > 0 ? attributes : void 0;
        }
        AttributeMap6.transform = transform;
      })(AttributeMap5 || (AttributeMap5 = {}));
      exports2.default = AttributeMap5;
    }
  });

  // node_modules/quill-delta/dist/Op.js
  var require_Op = __commonJS({
    "node_modules/quill-delta/dist/Op.js"(exports2) {
      "use strict";
      Object.defineProperty(exports2, "__esModule", { value: true });
      var Op4;
      (function(Op5) {
        function length(op) {
          if (typeof op.delete === "number") {
            return op.delete;
          } else if (typeof op.retain === "number") {
            return op.retain;
          } else if (typeof op.retain === "object" && op.retain !== null) {
            return 1;
          } else {
            return typeof op.insert === "string" ? op.insert.length : 1;
          }
        }
        Op5.length = length;
      })(Op4 || (Op4 = {}));
      exports2.default = Op4;
    }
  });

  // node_modules/quill-delta/dist/OpIterator.js
  var require_OpIterator = __commonJS({
    "node_modules/quill-delta/dist/OpIterator.js"(exports2) {
      "use strict";
      Object.defineProperty(exports2, "__esModule", { value: true });
      var Op_1 = require_Op();
      var Iterator = class {
        constructor(ops) {
          this.ops = ops;
          this.index = 0;
          this.offset = 0;
        }
        hasNext() {
          return this.peekLength() < Infinity;
        }
        next(length) {
          if (!length) {
            length = Infinity;
          }
          const nextOp = this.ops[this.index];
          if (nextOp) {
            const offset = this.offset;
            const opLength = Op_1.default.length(nextOp);
            if (length >= opLength - offset) {
              length = opLength - offset;
              this.index += 1;
              this.offset = 0;
            } else {
              this.offset += length;
            }
            if (typeof nextOp.delete === "number") {
              return { delete: length };
            } else {
              const retOp = {};
              if (nextOp.attributes) {
                retOp.attributes = nextOp.attributes;
              }
              if (typeof nextOp.retain === "number") {
                retOp.retain = length;
              } else if (typeof nextOp.retain === "object" && nextOp.retain !== null) {
                retOp.retain = nextOp.retain;
              } else if (typeof nextOp.insert === "string") {
                retOp.insert = nextOp.insert.substr(offset, length);
              } else {
                retOp.insert = nextOp.insert;
              }
              return retOp;
            }
          } else {
            return { retain: Infinity };
          }
        }
        peek() {
          return this.ops[this.index];
        }
        peekLength() {
          if (this.ops[this.index]) {
            return Op_1.default.length(this.ops[this.index]) - this.offset;
          } else {
            return Infinity;
          }
        }
        peekType() {
          const op = this.ops[this.index];
          if (op) {
            if (typeof op.delete === "number") {
              return "delete";
            } else if (typeof op.retain === "number" || typeof op.retain === "object" && op.retain !== null) {
              return "retain";
            } else {
              return "insert";
            }
          }
          return "retain";
        }
        rest() {
          if (!this.hasNext()) {
            return [];
          } else if (this.offset === 0) {
            return this.ops.slice(this.index);
          } else {
            const offset = this.offset;
            const index = this.index;
            const next = this.next();
            const rest = this.ops.slice(this.index);
            this.offset = offset;
            this.index = index;
            return [next].concat(rest);
          }
        }
      };
      exports2.default = Iterator;
    }
  });

  // node_modules/quill-delta/dist/Delta.js
  var require_Delta = __commonJS({
    "node_modules/quill-delta/dist/Delta.js"(exports2, module2) {
      "use strict";
      Object.defineProperty(exports2, "__esModule", { value: true });
      exports2.AttributeMap = exports2.OpIterator = exports2.Op = void 0;
      var diff = require_diff();
      var cloneDeep2 = require_lodash();
      var isEqual3 = require_lodash2();
      var AttributeMap_1 = require_AttributeMap();
      exports2.AttributeMap = AttributeMap_1.default;
      var Op_1 = require_Op();
      exports2.Op = Op_1.default;
      var OpIterator_1 = require_OpIterator();
      exports2.OpIterator = OpIterator_1.default;
      var NULL_CHARACTER = String.fromCharCode(0);
      var getEmbedTypeAndData = (a, b) => {
        if (typeof a !== "object" || a === null) {
          throw new Error(`cannot retain a ${typeof a}`);
        }
        if (typeof b !== "object" || b === null) {
          throw new Error(`cannot retain a ${typeof b}`);
        }
        const embedType = Object.keys(a)[0];
        if (!embedType || embedType !== Object.keys(b)[0]) {
          throw new Error(`embed types not matched: ${embedType} != ${Object.keys(b)[0]}`);
        }
        return [embedType, a[embedType], b[embedType]];
      };
      var Delta13 = class _Delta {
        constructor(ops) {
          if (Array.isArray(ops)) {
            this.ops = ops;
          } else if (ops != null && Array.isArray(ops.ops)) {
            this.ops = ops.ops;
          } else {
            this.ops = [];
          }
        }
        static registerEmbed(embedType, handler) {
          this.handlers[embedType] = handler;
        }
        static unregisterEmbed(embedType) {
          delete this.handlers[embedType];
        }
        static getHandler(embedType) {
          const handler = this.handlers[embedType];
          if (!handler) {
            throw new Error(`no handlers for embed type "${embedType}"`);
          }
          return handler;
        }
        insert(arg, attributes) {
          const newOp = {};
          if (typeof arg === "string" && arg.length === 0) {
            return this;
          }
          newOp.insert = arg;
          if (attributes != null && typeof attributes === "object" && Object.keys(attributes).length > 0) {
            newOp.attributes = attributes;
          }
          return this.push(newOp);
        }
        delete(length) {
          if (length <= 0) {
            return this;
          }
          return this.push({ delete: length });
        }
        retain(length, attributes) {
          if (typeof length === "number" && length <= 0) {
            return this;
          }
          const newOp = { retain: length };
          if (attributes != null && typeof attributes === "object" && Object.keys(attributes).length > 0) {
            newOp.attributes = attributes;
          }
          return this.push(newOp);
        }
        push(newOp) {
          let index = this.ops.length;
          let lastOp = this.ops[index - 1];
          newOp = cloneDeep2(newOp);
          if (typeof lastOp === "object") {
            if (typeof newOp.delete === "number" && typeof lastOp.delete === "number") {
              this.ops[index - 1] = { delete: lastOp.delete + newOp.delete };
              return this;
            }
            if (typeof lastOp.delete === "number" && newOp.insert != null) {
              index -= 1;
              lastOp = this.ops[index - 1];
              if (typeof lastOp !== "object") {
                this.ops.unshift(newOp);
                return this;
              }
            }
            if (isEqual3(newOp.attributes, lastOp.attributes)) {
              if (typeof newOp.insert === "string" && typeof lastOp.insert === "string") {
                this.ops[index - 1] = { insert: lastOp.insert + newOp.insert };
                if (typeof newOp.attributes === "object") {
                  this.ops[index - 1].attributes = newOp.attributes;
                }
                return this;
              } else if (typeof newOp.retain === "number" && typeof lastOp.retain === "number") {
                this.ops[index - 1] = { retain: lastOp.retain + newOp.retain };
                if (typeof newOp.attributes === "object") {
                  this.ops[index - 1].attributes = newOp.attributes;
                }
                return this;
              }
            }
          }
          if (index === this.ops.length) {
            this.ops.push(newOp);
          } else {
            this.ops.splice(index, 0, newOp);
          }
          return this;
        }
        chop() {
          const lastOp = this.ops[this.ops.length - 1];
          if (lastOp && typeof lastOp.retain === "number" && !lastOp.attributes) {
            this.ops.pop();
          }
          return this;
        }
        filter(predicate) {
          return this.ops.filter(predicate);
        }
        forEach(predicate) {
          this.ops.forEach(predicate);
        }
        map(predicate) {
          return this.ops.map(predicate);
        }
        partition(predicate) {
          const passed = [];
          const failed = [];
          this.forEach((op) => {
            const target = predicate(op) ? passed : failed;
            target.push(op);
          });
          return [passed, failed];
        }
        reduce(predicate, initialValue) {
          return this.ops.reduce(predicate, initialValue);
        }
        changeLength() {
          return this.reduce((length, elem) => {
            if (elem.insert) {
              return length + Op_1.default.length(elem);
            } else if (elem.delete) {
              return length - elem.delete;
            }
            return length;
          }, 0);
        }
        length() {
          return this.reduce((length, elem) => {
            return length + Op_1.default.length(elem);
          }, 0);
        }
        slice(start = 0, end = Infinity) {
          const ops = [];
          const iter = new OpIterator_1.default(this.ops);
          let index = 0;
          while (index < end && iter.hasNext()) {
            let nextOp;
            if (index < start) {
              nextOp = iter.next(start - index);
            } else {
              nextOp = iter.next(end - index);
              ops.push(nextOp);
            }
            index += Op_1.default.length(nextOp);
          }
          return new _Delta(ops);
        }
        compose(other) {
          const thisIter = new OpIterator_1.default(this.ops);
          const otherIter = new OpIterator_1.default(other.ops);
          const ops = [];
          const firstOther = otherIter.peek();
          if (firstOther != null && typeof firstOther.retain === "number" && firstOther.attributes == null) {
            let firstLeft = firstOther.retain;
            while (thisIter.peekType() === "insert" && thisIter.peekLength() <= firstLeft) {
              firstLeft -= thisIter.peekLength();
              ops.push(thisIter.next());
            }
            if (firstOther.retain - firstLeft > 0) {
              otherIter.next(firstOther.retain - firstLeft);
            }
          }
          const delta = new _Delta(ops);
          while (thisIter.hasNext() || otherIter.hasNext()) {
            if (otherIter.peekType() === "insert") {
              delta.push(otherIter.next());
            } else if (thisIter.peekType() === "delete") {
              delta.push(thisIter.next());
            } else {
              const length = Math.min(thisIter.peekLength(), otherIter.peekLength());
              const thisOp = thisIter.next(length);
              const otherOp = otherIter.next(length);
              if (otherOp.retain) {
                const newOp = {};
                if (typeof thisOp.retain === "number") {
                  newOp.retain = typeof otherOp.retain === "number" ? length : otherOp.retain;
                } else {
                  if (typeof otherOp.retain === "number") {
                    if (thisOp.retain == null) {
                      newOp.insert = thisOp.insert;
                    } else {
                      newOp.retain = thisOp.retain;
                    }
                  } else {
                    const action = thisOp.retain == null ? "insert" : "retain";
                    const [embedType, thisData, otherData] = getEmbedTypeAndData(thisOp[action], otherOp.retain);
                    const handler = _Delta.getHandler(embedType);
                    newOp[action] = {
                      [embedType]: handler.compose(thisData, otherData, action === "retain")
                    };
                  }
                }
                const attributes = AttributeMap_1.default.compose(thisOp.attributes, otherOp.attributes, typeof thisOp.retain === "number");
                if (attributes) {
                  newOp.attributes = attributes;
                }
                delta.push(newOp);
                if (!otherIter.hasNext() && isEqual3(delta.ops[delta.ops.length - 1], newOp)) {
                  const rest = new _Delta(thisIter.rest());
                  return delta.concat(rest).chop();
                }
              } else if (typeof otherOp.delete === "number" && (typeof thisOp.retain === "number" || typeof thisOp.retain === "object" && thisOp.retain !== null)) {
                delta.push(otherOp);
              }
            }
          }
          return delta.chop();
        }
        concat(other) {
          const delta = new _Delta(this.ops.slice());
          if (other.ops.length > 0) {
            delta.push(other.ops[0]);
            delta.ops = delta.ops.concat(other.ops.slice(1));
          }
          return delta;
        }
        diff(other, cursor) {
          if (this.ops === other.ops) {
            return new _Delta();
          }
          const strings = [this, other].map((delta) => {
            return delta.map((op) => {
              if (op.insert != null) {
                return typeof op.insert === "string" ? op.insert : NULL_CHARACTER;
              }
              const prep = delta === other ? "on" : "with";
              throw new Error("diff() called " + prep + " non-document");
            }).join("");
          });
          const retDelta = new _Delta();
          const diffResult = diff(strings[0], strings[1], cursor, true);
          const thisIter = new OpIterator_1.default(this.ops);
          const otherIter = new OpIterator_1.default(other.ops);
          diffResult.forEach((component) => {
            let length = component[1].length;
            while (length > 0) {
              let opLength = 0;
              switch (component[0]) {
                case diff.INSERT:
                  opLength = Math.min(otherIter.peekLength(), length);
                  retDelta.push(otherIter.next(opLength));
                  break;
                case diff.DELETE:
                  opLength = Math.min(length, thisIter.peekLength());
                  thisIter.next(opLength);
                  retDelta.delete(opLength);
                  break;
                case diff.EQUAL:
                  opLength = Math.min(thisIter.peekLength(), otherIter.peekLength(), length);
                  const thisOp = thisIter.next(opLength);
                  const otherOp = otherIter.next(opLength);
                  if (isEqual3(thisOp.insert, otherOp.insert)) {
                    retDelta.retain(opLength, AttributeMap_1.default.diff(thisOp.attributes, otherOp.attributes));
                  } else {
                    retDelta.push(otherOp).delete(opLength);
                  }
                  break;
              }
              length -= opLength;
            }
          });
          return retDelta.chop();
        }
        eachLine(predicate, newline = "\n") {
          const iter = new OpIterator_1.default(this.ops);
          let line = new _Delta();
          let i = 0;
          while (iter.hasNext()) {
            if (iter.peekType() !== "insert") {
              return;
            }
            const thisOp = iter.peek();
            const start = Op_1.default.length(thisOp) - iter.peekLength();
            const index = typeof thisOp.insert === "string" ? thisOp.insert.indexOf(newline, start) - start : -1;
            if (index < 0) {
              line.push(iter.next());
            } else if (index > 0) {
              line.push(iter.next(index));
            } else {
              if (predicate(line, iter.next(1).attributes || {}, i) === false) {
                return;
              }
              i += 1;
              line = new _Delta();
            }
          }
          if (line.length() > 0) {
            predicate(line, {}, i);
          }
        }
        invert(base) {
          const inverted = new _Delta();
          this.reduce((baseIndex, op) => {
            if (op.insert) {
              inverted.delete(Op_1.default.length(op));
            } else if (typeof op.retain === "number" && op.attributes == null) {
              inverted.retain(op.retain);
              return baseIndex + op.retain;
            } else if (op.delete || typeof op.retain === "number") {
              const length = op.delete || op.retain;
              const slice = base.slice(baseIndex, baseIndex + length);
              slice.forEach((baseOp) => {
                if (op.delete) {
                  inverted.push(baseOp);
                } else if (op.retain && op.attributes) {
                  inverted.retain(Op_1.default.length(baseOp), AttributeMap_1.default.invert(op.attributes, baseOp.attributes));
                }
              });
              return baseIndex + length;
            } else if (typeof op.retain === "object" && op.retain !== null) {
              const slice = base.slice(baseIndex, baseIndex + 1);
              const baseOp = new OpIterator_1.default(slice.ops).next();
              const [embedType, opData, baseOpData] = getEmbedTypeAndData(op.retain, baseOp.insert);
              const handler = _Delta.getHandler(embedType);
              inverted.retain({ [embedType]: handler.invert(opData, baseOpData) }, AttributeMap_1.default.invert(op.attributes, baseOp.attributes));
              return baseIndex + 1;
            }
            return baseIndex;
          }, 0);
          return inverted.chop();
        }
        transform(arg, priority = false) {
          priority = !!priority;
          if (typeof arg === "number") {
            return this.transformPosition(arg, priority);
          }
          const other = arg;
          const thisIter = new OpIterator_1.default(this.ops);
          const otherIter = new OpIterator_1.default(other.ops);
          const delta = new _Delta();
          while (thisIter.hasNext() || otherIter.hasNext()) {
            if (thisIter.peekType() === "insert" && (priority || otherIter.peekType() !== "insert")) {
              delta.retain(Op_1.default.length(thisIter.next()));
            } else if (otherIter.peekType() === "insert") {
              delta.push(otherIter.next());
            } else {
              const length = Math.min(thisIter.peekLength(), otherIter.peekLength());
              const thisOp = thisIter.next(length);
              const otherOp = otherIter.next(length);
              if (thisOp.delete) {
                continue;
              } else if (otherOp.delete) {
                delta.push(otherOp);
              } else {
                const thisData = thisOp.retain;
                const otherData = otherOp.retain;
                let transformedData = typeof otherData === "object" && otherData !== null ? otherData : length;
                if (typeof thisData === "object" && thisData !== null && typeof otherData === "object" && otherData !== null) {
                  const embedType = Object.keys(thisData)[0];
                  if (embedType === Object.keys(otherData)[0]) {
                    const handler = _Delta.getHandler(embedType);
                    if (handler) {
                      transformedData = {
                        [embedType]: handler.transform(thisData[embedType], otherData[embedType], priority)
                      };
                    }
                  }
                }
                delta.retain(transformedData, AttributeMap_1.default.transform(thisOp.attributes, otherOp.attributes, priority));
              }
            }
          }
          return delta.chop();
        }
        transformPosition(index, priority = false) {
          priority = !!priority;
          const thisIter = new OpIterator_1.default(this.ops);
          let offset = 0;
          while (thisIter.hasNext() && offset <= index) {
            const length = thisIter.peekLength();
            const nextType = thisIter.peekType();
            thisIter.next();
            if (nextType === "delete") {
              index -= Math.min(length, index - offset);
              continue;
            } else if (nextType === "insert" && (offset < index || !priority)) {
              index += length;
            }
            offset += length;
          }
          return index;
        }
      };
      Delta13.Op = Op_1.default;
      Delta13.OpIterator = OpIterator_1.default;
      Delta13.AttributeMap = AttributeMap_1.default;
      Delta13.handlers = {};
      exports2.default = Delta13;
      if (typeof module2 === "object") {
        module2.exports = Delta13;
        module2.exports.default = Delta13;
      }
    }
  });

  // node_modules/eventemitter3/index.js
  var require_eventemitter3 = __commonJS({
    "node_modules/eventemitter3/index.js"(exports2, module2) {
      "use strict";
      var has = Object.prototype.hasOwnProperty;
      var prefix = "~";
      function Events() {
      }
      if (Object.create) {
        Events.prototype = /* @__PURE__ */ Object.create(null);
        if (!new Events().__proto__)
          prefix = false;
      }
      function EE(fn, context, once) {
        this.fn = fn;
        this.context = context;
        this.once = once || false;
      }
      function addListener(emitter, event, fn, context, once) {
        if (typeof fn !== "function") {
          throw new TypeError("The listener must be a function");
        }
        var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
        if (!emitter._events[evt])
          emitter._events[evt] = listener, emitter._eventsCount++;
        else if (!emitter._events[evt].fn)
          emitter._events[evt].push(listener);
        else
          emitter._events[evt] = [emitter._events[evt], listener];
        return emitter;
      }
      function clearEvent(emitter, evt) {
        if (--emitter._eventsCount === 0)
          emitter._events = new Events();
        else
          delete emitter._events[evt];
      }
      function EventEmitter2() {
        this._events = new Events();
        this._eventsCount = 0;
      }
      EventEmitter2.prototype.eventNames = function eventNames() {
        var names = [], events, name;
        if (this._eventsCount === 0)
          return names;
        for (name in events = this._events) {
          if (has.call(events, name))
            names.push(prefix ? name.slice(1) : name);
        }
        if (Object.getOwnPropertySymbols) {
          return names.concat(Object.getOwnPropertySymbols(events));
        }
        return names;
      };
      EventEmitter2.prototype.listeners = function listeners(event) {
        var evt = prefix ? prefix + event : event, handlers = this._events[evt];
        if (!handlers)
          return [];
        if (handlers.fn)
          return [handlers.fn];
        for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
          ee[i] = handlers[i].fn;
        }
        return ee;
      };
      EventEmitter2.prototype.listenerCount = function listenerCount(event) {
        var evt = prefix ? prefix + event : event, listeners = this._events[evt];
        if (!listeners)
          return 0;
        if (listeners.fn)
          return 1;
        return listeners.length;
      };
      EventEmitter2.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt])
          return false;
        var listeners = this._events[evt], len = arguments.length, args, i;
        if (listeners.fn) {
          if (listeners.once)
            this.removeListener(event, listeners.fn, void 0, true);
          switch (len) {
            case 1:
              return listeners.fn.call(listeners.context), true;
            case 2:
              return listeners.fn.call(listeners.context, a1), true;
            case 3:
              return listeners.fn.call(listeners.context, a1, a2), true;
            case 4:
              return listeners.fn.call(listeners.context, a1, a2, a3), true;
            case 5:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
            case 6:
              return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
          }
          for (i = 1, args = new Array(len - 1); i < len; i++) {
            args[i - 1] = arguments[i];
          }
          listeners.fn.apply(listeners.context, args);
        } else {
          var length = listeners.length, j;
          for (i = 0; i < length; i++) {
            if (listeners[i].once)
              this.removeListener(event, listeners[i].fn, void 0, true);
            switch (len) {
              case 1:
                listeners[i].fn.call(listeners[i].context);
                break;
              case 2:
                listeners[i].fn.call(listeners[i].context, a1);
                break;
              case 3:
                listeners[i].fn.call(listeners[i].context, a1, a2);
                break;
              case 4:
                listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                break;
              default:
                if (!args)
                  for (j = 1, args = new Array(len - 1); j < len; j++) {
                    args[j - 1] = arguments[j];
                  }
                listeners[i].fn.apply(listeners[i].context, args);
            }
          }
        }
        return true;
      };
      EventEmitter2.prototype.on = function on(event, fn, context) {
        return addListener(this, event, fn, context, false);
      };
      EventEmitter2.prototype.once = function once(event, fn, context) {
        return addListener(this, event, fn, context, true);
      };
      EventEmitter2.prototype.removeListener = function removeListener(event, fn, context, once) {
        var evt = prefix ? prefix + event : event;
        if (!this._events[evt])
          return this;
        if (!fn) {
          clearEvent(this, evt);
          return this;
        }
        var listeners = this._events[evt];
        if (listeners.fn) {
          if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
            clearEvent(this, evt);
          }
        } else {
          for (var i = 0, events = [], length = listeners.length; i < length; i++) {
            if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
              events.push(listeners[i]);
            }
          }
          if (events.length)
            this._events[evt] = events.length === 1 ? events[0] : events;
          else
            clearEvent(this, evt);
        }
        return this;
      };
      EventEmitter2.prototype.removeAllListeners = function removeAllListeners(event) {
        var evt;
        if (event) {
          evt = prefix ? prefix + event : event;
          if (this._events[evt])
            clearEvent(this, evt);
        } else {
          this._events = new Events();
          this._eventsCount = 0;
        }
        return this;
      };
      EventEmitter2.prototype.off = EventEmitter2.prototype.removeListener;
      EventEmitter2.prototype.addListener = EventEmitter2.prototype.on;
      EventEmitter2.prefixed = prefix;
      EventEmitter2.EventEmitter = EventEmitter2;
      if ("undefined" !== typeof module2) {
        module2.exports = EventEmitter2;
      }
    }
  });

  // src/config.js
  var CONFIG = {
    // Sizing constraints
    MIN_ELEMENT_SIZE: 50,
    KEYBOARD_MOVE_STEP: 10,
    // Font constraints
    MIN_FONT_SIZE: 8,
    DEFAULT_FONT_SIZE: 16,
    FONT_SIZE_STEP: 2,
    // Timing
    HOVER_TIMEOUT: 500,
    // Undo/Redo
    MAX_UNDO_STACK_SIZE: 50,
    // New element defaults
    NEW_TEXT_CONTENT: "New text",
    NEW_TEXT_WIDTH: 200,
    NEW_TEXT_HEIGHT: 50,
    NEW_SLIDE_HEADING: "## New Slide",
    // Arrow defaults
    NEW_ARROW_LENGTH: 150,
    ARROW_HANDLE_SIZE: 12,
    ARROW_CONTROL_HANDLE_SIZE: 10,
    ARROW_DEFAULT_COLOR: "black",
    ARROW_DEFAULT_WIDTH: 2,
    ARROW_CONTROL1_COLOR: "#ff6600",
    ARROW_CONTROL2_COLOR: "#9933ff",
    ARROW_WAYPOINT_COLOR: "#f59e0b",
    ARROW_WAYPOINT_HANDLE_SIZE: 10,
    ARROW_DEFAULT_LABEL_POSITION: "middle",
    ARROW_DEFAULT_LABEL_OFFSET: 10,
    // Rotation steps (degrees)
    ROTATE_SNAP_STEP: 15,
    ROTATE_KEY_STEP: 5,
    // Arrow geometry
    ARROW_DOUBLE_LINE_OFFSET_MULTIPLIER: 1.5,
    // offset = width * this
    ARROW_CONTROL_POINT_DISPLACEMENT: 50,
    // perpendicular offset for bezier control points
    ARROW_LABEL_T_START: 0.15,
    ARROW_LABEL_T_END: 0.85,
    ARROW_LABEL_T_MIDDLE: 0.5,
    ARROW_LABEL_FLIP_THRESHOLD: 90,
    // degrees, label flips past this angle
    ARROW_HANDLE_OFFSET: -6,
    // px, center handles on path point
    // Polling config
    POLL_MAX_ATTEMPTS: 50,
    POLL_INTERVAL_MS: 100,
    // New fence default
    NEW_FENCE_LENGTH: 3,
    // Default slide dimensions (fallback when offsetWidth/Height is unavailable)
    DEFAULT_SLIDE_WIDTH: 960,
    DEFAULT_SLIDE_HEIGHT: 700
  };

  // src/utils.js
  function round(n) {
    return Math.round(n * 10) / 10;
  }
  function debug(...args) {
    if (typeof window !== "undefined" && window.EDITABLE_DEBUG) {
      console.debug("[editable]", ...args);
    }
  }
  function getSlideScale() {
    const slidesContainerEl = document.querySelector(".slides");
    return slidesContainerEl ? parseFloat(window.getComputedStyle(slidesContainerEl).getPropertyValue("--slide-scale")) || 1 : 1;
  }
  function getClientCoordinates(e, cachedScale) {
    const isTouch = e.type.startsWith("touch");
    const scale = cachedScale || getSlideScale();
    return {
      clientX: (isTouch ? e.touches[0].clientX : e.clientX) / scale,
      clientY: (isTouch ? e.touches[0].clientY : e.clientY) / scale
    };
  }
  function createButton(text, additionalClasses) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "editable-button " + additionalClasses;
    return button;
  }
  function changeFontSize(element, delta, editableRegistry2) {
    const currentFontSize = parseFloat(window.getComputedStyle(element).fontSize) || CONFIG.DEFAULT_FONT_SIZE;
    const newFontSize = Math.max(CONFIG.MIN_FONT_SIZE, currentFontSize + delta);
    element.style.fontSize = newFontSize + "px";
    const editableElt = editableRegistry2.get(element);
    if (editableElt) {
      editableElt.state.fontSize = newFontSize;
    }
  }
  function getEditableElements() {
    return document.querySelectorAll("img.editable, div.editable");
  }
  function getOriginalEditableElements() {
    return document.querySelectorAll("img.editable:not(.editable-new), div.editable:not(.editable-new)");
  }
  function getOriginalEditableDivs() {
    return document.querySelectorAll("div.editable:not(.editable-new)");
  }
  function getRawClient(e) {
    if (e.type.startsWith("touch")) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }
  function getCurrentSlideIndex() {
    if (typeof Reveal === "undefined")
      return 0;
    const indices = Reveal.getIndices();
    return indices.h;
  }
  function getCurrentSlide() {
    const nonStack = document.querySelector("section.present:not(.stack)");
    if (nonStack)
      return nonStack;
    const allPresent = Array.from(document.querySelectorAll("section.present"));
    return allPresent.find((s) => !s.querySelector("section")) || allPresent[0] || null;
  }
  function hasTitleSlide() {
    if (typeof Reveal === "undefined")
      return false;
    const firstSlide = Reveal.getSlide(0);
    if (!firstSlide)
      return false;
    return firstSlide.id === "title-slide" || firstSlide.classList.contains("quarto-title-block");
  }
  function getQmdHeadingIndex(revealIndex) {
    if (hasTitleSlide()) {
      return revealIndex - 1;
    }
    return revealIndex;
  }

  // src/editable-element.js
  var editableRegistry = /* @__PURE__ */ new Map();
  var EditableElement = class {
    /**
     * @param {HTMLElement} element - The DOM element to wrap
     */
    constructor(element) {
      this.element = element;
      this.container = null;
      this.type = element.tagName.toLowerCase();
      let width = element.style.width ? parseFloat(element.style.width) : element.offsetWidth;
      let height = element.style.height ? parseFloat(element.style.height) : element.offsetHeight;
      if (this.type === "img" && (width === 0 || height === 0)) {
        width = element.naturalWidth || width;
        height = element.naturalHeight || height;
      }
      this.state = {
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        // Div-specific properties
        fontSize: null,
        textAlign: null,
        // Image-specific properties
        src: null,
        opacity: 100,
        borderRadius: 0,
        cropTop: 0,
        cropRight: 0,
        cropBottom: 0,
        cropLeft: 0,
        flipH: false,
        flipV: false
      };
    }
    /**
     * Get a copy of current state.
     * @returns {Object} Copy of state object
     */
    getState() {
      return { ...this.state };
    }
    /**
     * Update state and optionally sync to DOM.
     * @param {Object} updates - Properties to update
     * @param {boolean} [syncToDOM=true] - Whether to apply changes to DOM
     */
    setState(updates, syncToDOM = true) {
      Object.assign(this.state, updates);
      if (syncToDOM) {
        this.syncToDOM();
      }
    }
    /**
     * Apply internal state to DOM elements.
     * Called after state changes to update visual representation.
     */
    syncToDOM() {
      if (this.container) {
        this.container.style.left = this.state.x + "px";
        this.container.style.top = this.state.y + "px";
        if (this.state.rotation !== 0) {
          this.container.style.transform = `rotate(${this.state.rotation}deg)`;
        } else {
          this.container.style.transform = "";
        }
      }
      this.element.style.width = this.state.width + "px";
      this.element.style.height = this.state.height + "px";
      if (this.state.fontSize !== null) {
        this.element.style.fontSize = this.state.fontSize + "px";
      }
      if (this.state.textAlign !== null) {
        this.element.style.textAlign = this.state.textAlign;
      }
      if (this.type === "img") {
        this.element.style.opacity = this.state.opacity !== 100 ? this.state.opacity / 100 : "";
        this.element.style.borderRadius = this.state.borderRadius ? `${this.state.borderRadius}px` : "";
        const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = this.state;
        this.element.style.clipPath = ct || cr || cb || cl ? `inset(${ct}px ${cr}px ${cb}px ${cl}px)` : "";
        const scaleX = this.state.flipH ? -1 : 1;
        const scaleY = this.state.flipV ? -1 : 1;
        this.element.style.transform = scaleX !== 1 || scaleY !== 1 ? `scaleX(${scaleX}) scaleY(${scaleY})` : "";
      }
    }
    /**
     * Read current values from DOM into state.
     * Called before serialization to capture any direct DOM changes.
     */
    syncFromDOM() {
      if (this.container) {
        this.state.x = this.container.style.left ? parseFloat(this.container.style.left) : this.container.offsetLeft;
        this.state.y = this.container.style.top ? parseFloat(this.container.style.top) : this.container.offsetTop;
        const transform = this.container.style.transform || "";
        const rotateMatch = transform.match(/rotate\(([^)]+)deg\)/);
        this.state.rotation = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
      }
      this.state.width = this.element.style.width ? parseFloat(this.element.style.width) : this.element.offsetWidth;
      this.state.height = this.element.style.height ? parseFloat(this.element.style.height) : this.element.offsetHeight;
      if (this.type === "div") {
        if (this.element.style.fontSize) {
          this.state.fontSize = parseFloat(this.element.style.fontSize);
        }
        if (this.element.style.textAlign) {
          this.state.textAlign = this.element.style.textAlign;
        }
      }
      if (this.type === "img") {
        const opacityStr = this.element.style.opacity;
        this.state.opacity = opacityStr !== "" ? Math.round(parseFloat(opacityStr) * 100) : 100;
        const radiusStr = this.element.style.borderRadius;
        this.state.borderRadius = radiusStr ? parseFloat(radiusStr) : 0;
        const clipPath = this.element.style.clipPath || "";
        const insetMatch = clipPath.match(/inset\(([^)]+)\)/);
        if (insetMatch) {
          const parts = insetMatch[1].split(/\s+/).map(parseFloat);
          this.state.cropTop = parts[0] || 0;
          this.state.cropRight = parts[1] ?? parts[0] ?? 0;
          this.state.cropBottom = parts[2] ?? parts[0] ?? 0;
          this.state.cropLeft = parts[3] ?? parts[1] ?? parts[0] ?? 0;
        } else {
          this.state.cropTop = this.state.cropRight = this.state.cropBottom = this.state.cropLeft = 0;
        }
        const transform = this.element.style.transform || "";
        this.state.flipH = /scaleX\(-1\)/.test(transform);
        this.state.flipV = /scaleY\(-1\)/.test(transform);
      }
    }
    /**
     * Generate dimension object for serialization to QMD.
     * Syncs from DOM first to capture current values.
     * @returns {Object} Dimensions formatted for PropertySerializers
     */
    /**
     * Return all resize handle elements in this element's container.
     * @returns {HTMLElement[]}
     */
    getResizeHandles() {
      if (!this.container)
        return [];
      return Array.from(this.container.querySelectorAll(".resize-handle"));
    }
    toDimensions() {
      this.syncFromDOM();
      const dims = {
        width: this.state.width,
        height: this.state.height,
        left: this.state.x,
        top: this.state.y
      };
      if (this.state.rotation !== 0) {
        dims.rotation = this.state.rotation;
      }
      if (this.type === "div") {
        if (this.state.fontSize !== null) {
          dims.fontSize = this.state.fontSize;
        }
        if (this.state.textAlign !== null) {
          dims.textAlign = this.state.textAlign;
        }
      }
      if (this.type === "img") {
        if (this.state.src !== null) {
          dims.src = this.state.src;
        }
        if (this.state.opacity !== 100) {
          dims.opacity = this.state.opacity;
        }
        if (this.state.borderRadius) {
          dims.borderRadius = this.state.borderRadius;
        }
        const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = this.state;
        if (ct || cr || cb || cl) {
          dims.cropTop = ct;
          dims.cropRight = cr;
          dims.cropBottom = cb;
          dims.cropLeft = cl;
        }
        if (this.state.flipH || this.state.flipV) {
          dims.flipH = this.state.flipH;
          dims.flipV = this.state.flipV;
        }
      }
      return dims;
    }
  };

  // node_modules/lodash-es/_freeGlobal.js
  var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
  var freeGlobal_default = freeGlobal;

  // node_modules/lodash-es/_root.js
  var freeSelf = typeof self == "object" && self && self.Object === Object && self;
  var root = freeGlobal_default || freeSelf || Function("return this")();
  var root_default = root;

  // node_modules/lodash-es/_Symbol.js
  var Symbol2 = root_default.Symbol;
  var Symbol_default = Symbol2;

  // node_modules/lodash-es/_getRawTag.js
  var objectProto = Object.prototype;
  var hasOwnProperty = objectProto.hasOwnProperty;
  var nativeObjectToString = objectProto.toString;
  var symToStringTag = Symbol_default ? Symbol_default.toStringTag : void 0;
  function getRawTag(value) {
    var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
    try {
      value[symToStringTag] = void 0;
      var unmasked = true;
    } catch (e) {
    }
    var result = nativeObjectToString.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag] = tag;
      } else {
        delete value[symToStringTag];
      }
    }
    return result;
  }
  var getRawTag_default = getRawTag;

  // node_modules/lodash-es/_objectToString.js
  var objectProto2 = Object.prototype;
  var nativeObjectToString2 = objectProto2.toString;
  function objectToString(value) {
    return nativeObjectToString2.call(value);
  }
  var objectToString_default = objectToString;

  // node_modules/lodash-es/_baseGetTag.js
  var nullTag = "[object Null]";
  var undefinedTag = "[object Undefined]";
  var symToStringTag2 = Symbol_default ? Symbol_default.toStringTag : void 0;
  function baseGetTag(value) {
    if (value == null) {
      return value === void 0 ? undefinedTag : nullTag;
    }
    return symToStringTag2 && symToStringTag2 in Object(value) ? getRawTag_default(value) : objectToString_default(value);
  }
  var baseGetTag_default = baseGetTag;

  // node_modules/lodash-es/isObjectLike.js
  function isObjectLike(value) {
    return value != null && typeof value == "object";
  }
  var isObjectLike_default = isObjectLike;

  // node_modules/lodash-es/isArray.js
  var isArray = Array.isArray;
  var isArray_default = isArray;

  // node_modules/lodash-es/isObject.js
  function isObject(value) {
    var type = typeof value;
    return value != null && (type == "object" || type == "function");
  }
  var isObject_default = isObject;

  // node_modules/lodash-es/identity.js
  function identity(value) {
    return value;
  }
  var identity_default = identity;

  // node_modules/lodash-es/isFunction.js
  var asyncTag = "[object AsyncFunction]";
  var funcTag = "[object Function]";
  var genTag = "[object GeneratorFunction]";
  var proxyTag = "[object Proxy]";
  function isFunction(value) {
    if (!isObject_default(value)) {
      return false;
    }
    var tag = baseGetTag_default(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
  }
  var isFunction_default = isFunction;

  // node_modules/lodash-es/_coreJsData.js
  var coreJsData = root_default["__core-js_shared__"];
  var coreJsData_default = coreJsData;

  // node_modules/lodash-es/_isMasked.js
  var maskSrcKey = function() {
    var uid = /[^.]+$/.exec(coreJsData_default && coreJsData_default.keys && coreJsData_default.keys.IE_PROTO || "");
    return uid ? "Symbol(src)_1." + uid : "";
  }();
  function isMasked(func) {
    return !!maskSrcKey && maskSrcKey in func;
  }
  var isMasked_default = isMasked;

  // node_modules/lodash-es/_toSource.js
  var funcProto = Function.prototype;
  var funcToString = funcProto.toString;
  function toSource(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {
      }
      try {
        return func + "";
      } catch (e) {
      }
    }
    return "";
  }
  var toSource_default = toSource;

  // node_modules/lodash-es/_baseIsNative.js
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
  var reIsHostCtor = /^\[object .+?Constructor\]$/;
  var funcProto2 = Function.prototype;
  var objectProto3 = Object.prototype;
  var funcToString2 = funcProto2.toString;
  var hasOwnProperty2 = objectProto3.hasOwnProperty;
  var reIsNative = RegExp(
    "^" + funcToString2.call(hasOwnProperty2).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
  );
  function baseIsNative(value) {
    if (!isObject_default(value) || isMasked_default(value)) {
      return false;
    }
    var pattern = isFunction_default(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource_default(value));
  }
  var baseIsNative_default = baseIsNative;

  // node_modules/lodash-es/_getValue.js
  function getValue(object, key) {
    return object == null ? void 0 : object[key];
  }
  var getValue_default = getValue;

  // node_modules/lodash-es/_getNative.js
  function getNative(object, key) {
    var value = getValue_default(object, key);
    return baseIsNative_default(value) ? value : void 0;
  }
  var getNative_default = getNative;

  // node_modules/lodash-es/_WeakMap.js
  var WeakMap2 = getNative_default(root_default, "WeakMap");
  var WeakMap_default = WeakMap2;

  // node_modules/lodash-es/_baseCreate.js
  var objectCreate = Object.create;
  var baseCreate = /* @__PURE__ */ function() {
    function object() {
    }
    return function(proto) {
      if (!isObject_default(proto)) {
        return {};
      }
      if (objectCreate) {
        return objectCreate(proto);
      }
      object.prototype = proto;
      var result = new object();
      object.prototype = void 0;
      return result;
    };
  }();
  var baseCreate_default = baseCreate;

  // node_modules/lodash-es/_apply.js
  function apply(func, thisArg, args) {
    switch (args.length) {
      case 0:
        return func.call(thisArg);
      case 1:
        return func.call(thisArg, args[0]);
      case 2:
        return func.call(thisArg, args[0], args[1]);
      case 3:
        return func.call(thisArg, args[0], args[1], args[2]);
    }
    return func.apply(thisArg, args);
  }
  var apply_default = apply;

  // node_modules/lodash-es/_copyArray.js
  function copyArray(source, array) {
    var index = -1, length = source.length;
    array || (array = Array(length));
    while (++index < length) {
      array[index] = source[index];
    }
    return array;
  }
  var copyArray_default = copyArray;

  // node_modules/lodash-es/_shortOut.js
  var HOT_COUNT = 800;
  var HOT_SPAN = 16;
  var nativeNow = Date.now;
  function shortOut(func) {
    var count = 0, lastCalled = 0;
    return function() {
      var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
      lastCalled = stamp;
      if (remaining > 0) {
        if (++count >= HOT_COUNT) {
          return arguments[0];
        }
      } else {
        count = 0;
      }
      return func.apply(void 0, arguments);
    };
  }
  var shortOut_default = shortOut;

  // node_modules/lodash-es/constant.js
  function constant(value) {
    return function() {
      return value;
    };
  }
  var constant_default = constant;

  // node_modules/lodash-es/_defineProperty.js
  var defineProperty = function() {
    try {
      var func = getNative_default(Object, "defineProperty");
      func({}, "", {});
      return func;
    } catch (e) {
    }
  }();
  var defineProperty_default = defineProperty;

  // node_modules/lodash-es/_baseSetToString.js
  var baseSetToString = !defineProperty_default ? identity_default : function(func, string) {
    return defineProperty_default(func, "toString", {
      "configurable": true,
      "enumerable": false,
      "value": constant_default(string),
      "writable": true
    });
  };
  var baseSetToString_default = baseSetToString;

  // node_modules/lodash-es/_setToString.js
  var setToString = shortOut_default(baseSetToString_default);
  var setToString_default = setToString;

  // node_modules/lodash-es/_arrayEach.js
  function arrayEach(array, iteratee) {
    var index = -1, length = array == null ? 0 : array.length;
    while (++index < length) {
      if (iteratee(array[index], index, array) === false) {
        break;
      }
    }
    return array;
  }
  var arrayEach_default = arrayEach;

  // node_modules/lodash-es/_isIndex.js
  var MAX_SAFE_INTEGER = 9007199254740991;
  var reIsUint = /^(?:0|[1-9]\d*)$/;
  function isIndex(value, length) {
    var type = typeof value;
    length = length == null ? MAX_SAFE_INTEGER : length;
    return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
  }
  var isIndex_default = isIndex;

  // node_modules/lodash-es/_baseAssignValue.js
  function baseAssignValue(object, key, value) {
    if (key == "__proto__" && defineProperty_default) {
      defineProperty_default(object, key, {
        "configurable": true,
        "enumerable": true,
        "value": value,
        "writable": true
      });
    } else {
      object[key] = value;
    }
  }
  var baseAssignValue_default = baseAssignValue;

  // node_modules/lodash-es/eq.js
  function eq(value, other) {
    return value === other || value !== value && other !== other;
  }
  var eq_default = eq;

  // node_modules/lodash-es/_assignValue.js
  var objectProto4 = Object.prototype;
  var hasOwnProperty3 = objectProto4.hasOwnProperty;
  function assignValue(object, key, value) {
    var objValue = object[key];
    if (!(hasOwnProperty3.call(object, key) && eq_default(objValue, value)) || value === void 0 && !(key in object)) {
      baseAssignValue_default(object, key, value);
    }
  }
  var assignValue_default = assignValue;

  // node_modules/lodash-es/_copyObject.js
  function copyObject(source, props, object, customizer) {
    var isNew = !object;
    object || (object = {});
    var index = -1, length = props.length;
    while (++index < length) {
      var key = props[index];
      var newValue = customizer ? customizer(object[key], source[key], key, object, source) : void 0;
      if (newValue === void 0) {
        newValue = source[key];
      }
      if (isNew) {
        baseAssignValue_default(object, key, newValue);
      } else {
        assignValue_default(object, key, newValue);
      }
    }
    return object;
  }
  var copyObject_default = copyObject;

  // node_modules/lodash-es/_overRest.js
  var nativeMax = Math.max;
  function overRest(func, start, transform) {
    start = nativeMax(start === void 0 ? func.length - 1 : start, 0);
    return function() {
      var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array(length);
      while (++index < length) {
        array[index] = args[start + index];
      }
      index = -1;
      var otherArgs = Array(start + 1);
      while (++index < start) {
        otherArgs[index] = args[index];
      }
      otherArgs[start] = transform(array);
      return apply_default(func, this, otherArgs);
    };
  }
  var overRest_default = overRest;

  // node_modules/lodash-es/_baseRest.js
  function baseRest(func, start) {
    return setToString_default(overRest_default(func, start, identity_default), func + "");
  }
  var baseRest_default = baseRest;

  // node_modules/lodash-es/isLength.js
  var MAX_SAFE_INTEGER2 = 9007199254740991;
  function isLength(value) {
    return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER2;
  }
  var isLength_default = isLength;

  // node_modules/lodash-es/isArrayLike.js
  function isArrayLike(value) {
    return value != null && isLength_default(value.length) && !isFunction_default(value);
  }
  var isArrayLike_default = isArrayLike;

  // node_modules/lodash-es/_isIterateeCall.js
  function isIterateeCall(value, index, object) {
    if (!isObject_default(object)) {
      return false;
    }
    var type = typeof index;
    if (type == "number" ? isArrayLike_default(object) && isIndex_default(index, object.length) : type == "string" && index in object) {
      return eq_default(object[index], value);
    }
    return false;
  }
  var isIterateeCall_default = isIterateeCall;

  // node_modules/lodash-es/_createAssigner.js
  function createAssigner(assigner) {
    return baseRest_default(function(object, sources) {
      var index = -1, length = sources.length, customizer = length > 1 ? sources[length - 1] : void 0, guard = length > 2 ? sources[2] : void 0;
      customizer = assigner.length > 3 && typeof customizer == "function" ? (length--, customizer) : void 0;
      if (guard && isIterateeCall_default(sources[0], sources[1], guard)) {
        customizer = length < 3 ? void 0 : customizer;
        length = 1;
      }
      object = Object(object);
      while (++index < length) {
        var source = sources[index];
        if (source) {
          assigner(object, source, index, customizer);
        }
      }
      return object;
    });
  }
  var createAssigner_default = createAssigner;

  // node_modules/lodash-es/_isPrototype.js
  var objectProto5 = Object.prototype;
  function isPrototype(value) {
    var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto5;
    return value === proto;
  }
  var isPrototype_default = isPrototype;

  // node_modules/lodash-es/_baseTimes.js
  function baseTimes(n, iteratee) {
    var index = -1, result = Array(n);
    while (++index < n) {
      result[index] = iteratee(index);
    }
    return result;
  }
  var baseTimes_default = baseTimes;

  // node_modules/lodash-es/_baseIsArguments.js
  var argsTag = "[object Arguments]";
  function baseIsArguments(value) {
    return isObjectLike_default(value) && baseGetTag_default(value) == argsTag;
  }
  var baseIsArguments_default = baseIsArguments;

  // node_modules/lodash-es/isArguments.js
  var objectProto6 = Object.prototype;
  var hasOwnProperty4 = objectProto6.hasOwnProperty;
  var propertyIsEnumerable = objectProto6.propertyIsEnumerable;
  var isArguments = baseIsArguments_default(/* @__PURE__ */ function() {
    return arguments;
  }()) ? baseIsArguments_default : function(value) {
    return isObjectLike_default(value) && hasOwnProperty4.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
  };
  var isArguments_default = isArguments;

  // node_modules/lodash-es/stubFalse.js
  function stubFalse() {
    return false;
  }
  var stubFalse_default = stubFalse;

  // node_modules/lodash-es/isBuffer.js
  var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
  var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
  var moduleExports = freeModule && freeModule.exports === freeExports;
  var Buffer2 = moduleExports ? root_default.Buffer : void 0;
  var nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0;
  var isBuffer = nativeIsBuffer || stubFalse_default;
  var isBuffer_default = isBuffer;

  // node_modules/lodash-es/_baseIsTypedArray.js
  var argsTag2 = "[object Arguments]";
  var arrayTag = "[object Array]";
  var boolTag = "[object Boolean]";
  var dateTag = "[object Date]";
  var errorTag = "[object Error]";
  var funcTag2 = "[object Function]";
  var mapTag = "[object Map]";
  var numberTag = "[object Number]";
  var objectTag = "[object Object]";
  var regexpTag = "[object RegExp]";
  var setTag = "[object Set]";
  var stringTag = "[object String]";
  var weakMapTag = "[object WeakMap]";
  var arrayBufferTag = "[object ArrayBuffer]";
  var dataViewTag = "[object DataView]";
  var float32Tag = "[object Float32Array]";
  var float64Tag = "[object Float64Array]";
  var int8Tag = "[object Int8Array]";
  var int16Tag = "[object Int16Array]";
  var int32Tag = "[object Int32Array]";
  var uint8Tag = "[object Uint8Array]";
  var uint8ClampedTag = "[object Uint8ClampedArray]";
  var uint16Tag = "[object Uint16Array]";
  var uint32Tag = "[object Uint32Array]";
  var typedArrayTags = {};
  typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
  typedArrayTags[argsTag2] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag2] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
  function baseIsTypedArray(value) {
    return isObjectLike_default(value) && isLength_default(value.length) && !!typedArrayTags[baseGetTag_default(value)];
  }
  var baseIsTypedArray_default = baseIsTypedArray;

  // node_modules/lodash-es/_baseUnary.js
  function baseUnary(func) {
    return function(value) {
      return func(value);
    };
  }
  var baseUnary_default = baseUnary;

  // node_modules/lodash-es/_nodeUtil.js
  var freeExports2 = typeof exports == "object" && exports && !exports.nodeType && exports;
  var freeModule2 = freeExports2 && typeof module == "object" && module && !module.nodeType && module;
  var moduleExports2 = freeModule2 && freeModule2.exports === freeExports2;
  var freeProcess = moduleExports2 && freeGlobal_default.process;
  var nodeUtil = function() {
    try {
      var types = freeModule2 && freeModule2.require && freeModule2.require("util").types;
      if (types) {
        return types;
      }
      return freeProcess && freeProcess.binding && freeProcess.binding("util");
    } catch (e) {
    }
  }();
  var nodeUtil_default = nodeUtil;

  // node_modules/lodash-es/isTypedArray.js
  var nodeIsTypedArray = nodeUtil_default && nodeUtil_default.isTypedArray;
  var isTypedArray = nodeIsTypedArray ? baseUnary_default(nodeIsTypedArray) : baseIsTypedArray_default;
  var isTypedArray_default = isTypedArray;

  // node_modules/lodash-es/_arrayLikeKeys.js
  var objectProto7 = Object.prototype;
  var hasOwnProperty5 = objectProto7.hasOwnProperty;
  function arrayLikeKeys(value, inherited) {
    var isArr = isArray_default(value), isArg = !isArr && isArguments_default(value), isBuff = !isArr && !isArg && isBuffer_default(value), isType = !isArr && !isArg && !isBuff && isTypedArray_default(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes_default(value.length, String) : [], length = result.length;
    for (var key in value) {
      if ((inherited || hasOwnProperty5.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
      (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
      isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
      isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
      isIndex_default(key, length)))) {
        result.push(key);
      }
    }
    return result;
  }
  var arrayLikeKeys_default = arrayLikeKeys;

  // node_modules/lodash-es/_overArg.js
  function overArg(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }
  var overArg_default = overArg;

  // node_modules/lodash-es/_nativeKeys.js
  var nativeKeys = overArg_default(Object.keys, Object);
  var nativeKeys_default = nativeKeys;

  // node_modules/lodash-es/_baseKeys.js
  var objectProto8 = Object.prototype;
  var hasOwnProperty6 = objectProto8.hasOwnProperty;
  function baseKeys(object) {
    if (!isPrototype_default(object)) {
      return nativeKeys_default(object);
    }
    var result = [];
    for (var key in Object(object)) {
      if (hasOwnProperty6.call(object, key) && key != "constructor") {
        result.push(key);
      }
    }
    return result;
  }
  var baseKeys_default = baseKeys;

  // node_modules/lodash-es/keys.js
  function keys(object) {
    return isArrayLike_default(object) ? arrayLikeKeys_default(object) : baseKeys_default(object);
  }
  var keys_default = keys;

  // node_modules/lodash-es/_nativeKeysIn.js
  function nativeKeysIn(object) {
    var result = [];
    if (object != null) {
      for (var key in Object(object)) {
        result.push(key);
      }
    }
    return result;
  }
  var nativeKeysIn_default = nativeKeysIn;

  // node_modules/lodash-es/_baseKeysIn.js
  var objectProto9 = Object.prototype;
  var hasOwnProperty7 = objectProto9.hasOwnProperty;
  function baseKeysIn(object) {
    if (!isObject_default(object)) {
      return nativeKeysIn_default(object);
    }
    var isProto = isPrototype_default(object), result = [];
    for (var key in object) {
      if (!(key == "constructor" && (isProto || !hasOwnProperty7.call(object, key)))) {
        result.push(key);
      }
    }
    return result;
  }
  var baseKeysIn_default = baseKeysIn;

  // node_modules/lodash-es/keysIn.js
  function keysIn(object) {
    return isArrayLike_default(object) ? arrayLikeKeys_default(object, true) : baseKeysIn_default(object);
  }
  var keysIn_default = keysIn;

  // node_modules/lodash-es/_nativeCreate.js
  var nativeCreate = getNative_default(Object, "create");
  var nativeCreate_default = nativeCreate;

  // node_modules/lodash-es/_hashClear.js
  function hashClear() {
    this.__data__ = nativeCreate_default ? nativeCreate_default(null) : {};
    this.size = 0;
  }
  var hashClear_default = hashClear;

  // node_modules/lodash-es/_hashDelete.js
  function hashDelete(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  }
  var hashDelete_default = hashDelete;

  // node_modules/lodash-es/_hashGet.js
  var HASH_UNDEFINED = "__lodash_hash_undefined__";
  var objectProto10 = Object.prototype;
  var hasOwnProperty8 = objectProto10.hasOwnProperty;
  function hashGet(key) {
    var data = this.__data__;
    if (nativeCreate_default) {
      var result = data[key];
      return result === HASH_UNDEFINED ? void 0 : result;
    }
    return hasOwnProperty8.call(data, key) ? data[key] : void 0;
  }
  var hashGet_default = hashGet;

  // node_modules/lodash-es/_hashHas.js
  var objectProto11 = Object.prototype;
  var hasOwnProperty9 = objectProto11.hasOwnProperty;
  function hashHas(key) {
    var data = this.__data__;
    return nativeCreate_default ? data[key] !== void 0 : hasOwnProperty9.call(data, key);
  }
  var hashHas_default = hashHas;

  // node_modules/lodash-es/_hashSet.js
  var HASH_UNDEFINED2 = "__lodash_hash_undefined__";
  function hashSet(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = nativeCreate_default && value === void 0 ? HASH_UNDEFINED2 : value;
    return this;
  }
  var hashSet_default = hashSet;

  // node_modules/lodash-es/_Hash.js
  function Hash(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  Hash.prototype.clear = hashClear_default;
  Hash.prototype["delete"] = hashDelete_default;
  Hash.prototype.get = hashGet_default;
  Hash.prototype.has = hashHas_default;
  Hash.prototype.set = hashSet_default;
  var Hash_default = Hash;

  // node_modules/lodash-es/_listCacheClear.js
  function listCacheClear() {
    this.__data__ = [];
    this.size = 0;
  }
  var listCacheClear_default = listCacheClear;

  // node_modules/lodash-es/_assocIndexOf.js
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq_default(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }
  var assocIndexOf_default = assocIndexOf;

  // node_modules/lodash-es/_listCacheDelete.js
  var arrayProto = Array.prototype;
  var splice = arrayProto.splice;
  function listCacheDelete(key) {
    var data = this.__data__, index = assocIndexOf_default(data, key);
    if (index < 0) {
      return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
      data.pop();
    } else {
      splice.call(data, index, 1);
    }
    --this.size;
    return true;
  }
  var listCacheDelete_default = listCacheDelete;

  // node_modules/lodash-es/_listCacheGet.js
  function listCacheGet(key) {
    var data = this.__data__, index = assocIndexOf_default(data, key);
    return index < 0 ? void 0 : data[index][1];
  }
  var listCacheGet_default = listCacheGet;

  // node_modules/lodash-es/_listCacheHas.js
  function listCacheHas(key) {
    return assocIndexOf_default(this.__data__, key) > -1;
  }
  var listCacheHas_default = listCacheHas;

  // node_modules/lodash-es/_listCacheSet.js
  function listCacheSet(key, value) {
    var data = this.__data__, index = assocIndexOf_default(data, key);
    if (index < 0) {
      ++this.size;
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }
  var listCacheSet_default = listCacheSet;

  // node_modules/lodash-es/_ListCache.js
  function ListCache(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  ListCache.prototype.clear = listCacheClear_default;
  ListCache.prototype["delete"] = listCacheDelete_default;
  ListCache.prototype.get = listCacheGet_default;
  ListCache.prototype.has = listCacheHas_default;
  ListCache.prototype.set = listCacheSet_default;
  var ListCache_default = ListCache;

  // node_modules/lodash-es/_Map.js
  var Map2 = getNative_default(root_default, "Map");
  var Map_default = Map2;

  // node_modules/lodash-es/_mapCacheClear.js
  function mapCacheClear() {
    this.size = 0;
    this.__data__ = {
      "hash": new Hash_default(),
      "map": new (Map_default || ListCache_default)(),
      "string": new Hash_default()
    };
  }
  var mapCacheClear_default = mapCacheClear;

  // node_modules/lodash-es/_isKeyable.js
  function isKeyable(value) {
    var type = typeof value;
    return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
  }
  var isKeyable_default = isKeyable;

  // node_modules/lodash-es/_getMapData.js
  function getMapData(map, key) {
    var data = map.__data__;
    return isKeyable_default(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
  }
  var getMapData_default = getMapData;

  // node_modules/lodash-es/_mapCacheDelete.js
  function mapCacheDelete(key) {
    var result = getMapData_default(this, key)["delete"](key);
    this.size -= result ? 1 : 0;
    return result;
  }
  var mapCacheDelete_default = mapCacheDelete;

  // node_modules/lodash-es/_mapCacheGet.js
  function mapCacheGet(key) {
    return getMapData_default(this, key).get(key);
  }
  var mapCacheGet_default = mapCacheGet;

  // node_modules/lodash-es/_mapCacheHas.js
  function mapCacheHas(key) {
    return getMapData_default(this, key).has(key);
  }
  var mapCacheHas_default = mapCacheHas;

  // node_modules/lodash-es/_mapCacheSet.js
  function mapCacheSet(key, value) {
    var data = getMapData_default(this, key), size = data.size;
    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
  }
  var mapCacheSet_default = mapCacheSet;

  // node_modules/lodash-es/_MapCache.js
  function MapCache(entries) {
    var index = -1, length = entries == null ? 0 : entries.length;
    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }
  MapCache.prototype.clear = mapCacheClear_default;
  MapCache.prototype["delete"] = mapCacheDelete_default;
  MapCache.prototype.get = mapCacheGet_default;
  MapCache.prototype.has = mapCacheHas_default;
  MapCache.prototype.set = mapCacheSet_default;
  var MapCache_default = MapCache;

  // node_modules/lodash-es/_arrayPush.js
  function arrayPush(array, values) {
    var index = -1, length = values.length, offset = array.length;
    while (++index < length) {
      array[offset + index] = values[index];
    }
    return array;
  }
  var arrayPush_default = arrayPush;

  // node_modules/lodash-es/_getPrototype.js
  var getPrototype = overArg_default(Object.getPrototypeOf, Object);
  var getPrototype_default = getPrototype;

  // node_modules/lodash-es/isPlainObject.js
  var objectTag2 = "[object Object]";
  var funcProto3 = Function.prototype;
  var objectProto12 = Object.prototype;
  var funcToString3 = funcProto3.toString;
  var hasOwnProperty10 = objectProto12.hasOwnProperty;
  var objectCtorString = funcToString3.call(Object);
  function isPlainObject(value) {
    if (!isObjectLike_default(value) || baseGetTag_default(value) != objectTag2) {
      return false;
    }
    var proto = getPrototype_default(value);
    if (proto === null) {
      return true;
    }
    var Ctor = hasOwnProperty10.call(proto, "constructor") && proto.constructor;
    return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString3.call(Ctor) == objectCtorString;
  }
  var isPlainObject_default = isPlainObject;

  // node_modules/lodash-es/_stackClear.js
  function stackClear() {
    this.__data__ = new ListCache_default();
    this.size = 0;
  }
  var stackClear_default = stackClear;

  // node_modules/lodash-es/_stackDelete.js
  function stackDelete(key) {
    var data = this.__data__, result = data["delete"](key);
    this.size = data.size;
    return result;
  }
  var stackDelete_default = stackDelete;

  // node_modules/lodash-es/_stackGet.js
  function stackGet(key) {
    return this.__data__.get(key);
  }
  var stackGet_default = stackGet;

  // node_modules/lodash-es/_stackHas.js
  function stackHas(key) {
    return this.__data__.has(key);
  }
  var stackHas_default = stackHas;

  // node_modules/lodash-es/_stackSet.js
  var LARGE_ARRAY_SIZE = 200;
  function stackSet(key, value) {
    var data = this.__data__;
    if (data instanceof ListCache_default) {
      var pairs = data.__data__;
      if (!Map_default || pairs.length < LARGE_ARRAY_SIZE - 1) {
        pairs.push([key, value]);
        this.size = ++data.size;
        return this;
      }
      data = this.__data__ = new MapCache_default(pairs);
    }
    data.set(key, value);
    this.size = data.size;
    return this;
  }
  var stackSet_default = stackSet;

  // node_modules/lodash-es/_Stack.js
  function Stack(entries) {
    var data = this.__data__ = new ListCache_default(entries);
    this.size = data.size;
  }
  Stack.prototype.clear = stackClear_default;
  Stack.prototype["delete"] = stackDelete_default;
  Stack.prototype.get = stackGet_default;
  Stack.prototype.has = stackHas_default;
  Stack.prototype.set = stackSet_default;
  var Stack_default = Stack;

  // node_modules/lodash-es/_baseAssign.js
  function baseAssign(object, source) {
    return object && copyObject_default(source, keys_default(source), object);
  }
  var baseAssign_default = baseAssign;

  // node_modules/lodash-es/_baseAssignIn.js
  function baseAssignIn(object, source) {
    return object && copyObject_default(source, keysIn_default(source), object);
  }
  var baseAssignIn_default = baseAssignIn;

  // node_modules/lodash-es/_cloneBuffer.js
  var freeExports3 = typeof exports == "object" && exports && !exports.nodeType && exports;
  var freeModule3 = freeExports3 && typeof module == "object" && module && !module.nodeType && module;
  var moduleExports3 = freeModule3 && freeModule3.exports === freeExports3;
  var Buffer3 = moduleExports3 ? root_default.Buffer : void 0;
  var allocUnsafe = Buffer3 ? Buffer3.allocUnsafe : void 0;
  function cloneBuffer(buffer, isDeep) {
    if (isDeep) {
      return buffer.slice();
    }
    var length = buffer.length, result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
    buffer.copy(result);
    return result;
  }
  var cloneBuffer_default = cloneBuffer;

  // node_modules/lodash-es/_arrayFilter.js
  function arrayFilter(array, predicate) {
    var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
    while (++index < length) {
      var value = array[index];
      if (predicate(value, index, array)) {
        result[resIndex++] = value;
      }
    }
    return result;
  }
  var arrayFilter_default = arrayFilter;

  // node_modules/lodash-es/stubArray.js
  function stubArray() {
    return [];
  }
  var stubArray_default = stubArray;

  // node_modules/lodash-es/_getSymbols.js
  var objectProto13 = Object.prototype;
  var propertyIsEnumerable2 = objectProto13.propertyIsEnumerable;
  var nativeGetSymbols = Object.getOwnPropertySymbols;
  var getSymbols = !nativeGetSymbols ? stubArray_default : function(object) {
    if (object == null) {
      return [];
    }
    object = Object(object);
    return arrayFilter_default(nativeGetSymbols(object), function(symbol) {
      return propertyIsEnumerable2.call(object, symbol);
    });
  };
  var getSymbols_default = getSymbols;

  // node_modules/lodash-es/_copySymbols.js
  function copySymbols(source, object) {
    return copyObject_default(source, getSymbols_default(source), object);
  }
  var copySymbols_default = copySymbols;

  // node_modules/lodash-es/_getSymbolsIn.js
  var nativeGetSymbols2 = Object.getOwnPropertySymbols;
  var getSymbolsIn = !nativeGetSymbols2 ? stubArray_default : function(object) {
    var result = [];
    while (object) {
      arrayPush_default(result, getSymbols_default(object));
      object = getPrototype_default(object);
    }
    return result;
  };
  var getSymbolsIn_default = getSymbolsIn;

  // node_modules/lodash-es/_copySymbolsIn.js
  function copySymbolsIn(source, object) {
    return copyObject_default(source, getSymbolsIn_default(source), object);
  }
  var copySymbolsIn_default = copySymbolsIn;

  // node_modules/lodash-es/_baseGetAllKeys.js
  function baseGetAllKeys(object, keysFunc, symbolsFunc) {
    var result = keysFunc(object);
    return isArray_default(object) ? result : arrayPush_default(result, symbolsFunc(object));
  }
  var baseGetAllKeys_default = baseGetAllKeys;

  // node_modules/lodash-es/_getAllKeys.js
  function getAllKeys(object) {
    return baseGetAllKeys_default(object, keys_default, getSymbols_default);
  }
  var getAllKeys_default = getAllKeys;

  // node_modules/lodash-es/_getAllKeysIn.js
  function getAllKeysIn(object) {
    return baseGetAllKeys_default(object, keysIn_default, getSymbolsIn_default);
  }
  var getAllKeysIn_default = getAllKeysIn;

  // node_modules/lodash-es/_DataView.js
  var DataView = getNative_default(root_default, "DataView");
  var DataView_default = DataView;

  // node_modules/lodash-es/_Promise.js
  var Promise2 = getNative_default(root_default, "Promise");
  var Promise_default = Promise2;

  // node_modules/lodash-es/_Set.js
  var Set2 = getNative_default(root_default, "Set");
  var Set_default = Set2;

  // node_modules/lodash-es/_getTag.js
  var mapTag2 = "[object Map]";
  var objectTag3 = "[object Object]";
  var promiseTag = "[object Promise]";
  var setTag2 = "[object Set]";
  var weakMapTag2 = "[object WeakMap]";
  var dataViewTag2 = "[object DataView]";
  var dataViewCtorString = toSource_default(DataView_default);
  var mapCtorString = toSource_default(Map_default);
  var promiseCtorString = toSource_default(Promise_default);
  var setCtorString = toSource_default(Set_default);
  var weakMapCtorString = toSource_default(WeakMap_default);
  var getTag = baseGetTag_default;
  if (DataView_default && getTag(new DataView_default(new ArrayBuffer(1))) != dataViewTag2 || Map_default && getTag(new Map_default()) != mapTag2 || Promise_default && getTag(Promise_default.resolve()) != promiseTag || Set_default && getTag(new Set_default()) != setTag2 || WeakMap_default && getTag(new WeakMap_default()) != weakMapTag2) {
    getTag = function(value) {
      var result = baseGetTag_default(value), Ctor = result == objectTag3 ? value.constructor : void 0, ctorString = Ctor ? toSource_default(Ctor) : "";
      if (ctorString) {
        switch (ctorString) {
          case dataViewCtorString:
            return dataViewTag2;
          case mapCtorString:
            return mapTag2;
          case promiseCtorString:
            return promiseTag;
          case setCtorString:
            return setTag2;
          case weakMapCtorString:
            return weakMapTag2;
        }
      }
      return result;
    };
  }
  var getTag_default = getTag;

  // node_modules/lodash-es/_initCloneArray.js
  var objectProto14 = Object.prototype;
  var hasOwnProperty11 = objectProto14.hasOwnProperty;
  function initCloneArray(array) {
    var length = array.length, result = new array.constructor(length);
    if (length && typeof array[0] == "string" && hasOwnProperty11.call(array, "index")) {
      result.index = array.index;
      result.input = array.input;
    }
    return result;
  }
  var initCloneArray_default = initCloneArray;

  // node_modules/lodash-es/_Uint8Array.js
  var Uint8Array2 = root_default.Uint8Array;
  var Uint8Array_default = Uint8Array2;

  // node_modules/lodash-es/_cloneArrayBuffer.js
  function cloneArrayBuffer(arrayBuffer) {
    var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
    new Uint8Array_default(result).set(new Uint8Array_default(arrayBuffer));
    return result;
  }
  var cloneArrayBuffer_default = cloneArrayBuffer;

  // node_modules/lodash-es/_cloneDataView.js
  function cloneDataView(dataView, isDeep) {
    var buffer = isDeep ? cloneArrayBuffer_default(dataView.buffer) : dataView.buffer;
    return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
  }
  var cloneDataView_default = cloneDataView;

  // node_modules/lodash-es/_cloneRegExp.js
  var reFlags = /\w*$/;
  function cloneRegExp(regexp) {
    var result = new regexp.constructor(regexp.source, reFlags.exec(regexp));
    result.lastIndex = regexp.lastIndex;
    return result;
  }
  var cloneRegExp_default = cloneRegExp;

  // node_modules/lodash-es/_cloneSymbol.js
  var symbolProto = Symbol_default ? Symbol_default.prototype : void 0;
  var symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
  function cloneSymbol(symbol) {
    return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
  }
  var cloneSymbol_default = cloneSymbol;

  // node_modules/lodash-es/_cloneTypedArray.js
  function cloneTypedArray(typedArray, isDeep) {
    var buffer = isDeep ? cloneArrayBuffer_default(typedArray.buffer) : typedArray.buffer;
    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
  }
  var cloneTypedArray_default = cloneTypedArray;

  // node_modules/lodash-es/_initCloneByTag.js
  var boolTag2 = "[object Boolean]";
  var dateTag2 = "[object Date]";
  var mapTag3 = "[object Map]";
  var numberTag2 = "[object Number]";
  var regexpTag2 = "[object RegExp]";
  var setTag3 = "[object Set]";
  var stringTag2 = "[object String]";
  var symbolTag = "[object Symbol]";
  var arrayBufferTag2 = "[object ArrayBuffer]";
  var dataViewTag3 = "[object DataView]";
  var float32Tag2 = "[object Float32Array]";
  var float64Tag2 = "[object Float64Array]";
  var int8Tag2 = "[object Int8Array]";
  var int16Tag2 = "[object Int16Array]";
  var int32Tag2 = "[object Int32Array]";
  var uint8Tag2 = "[object Uint8Array]";
  var uint8ClampedTag2 = "[object Uint8ClampedArray]";
  var uint16Tag2 = "[object Uint16Array]";
  var uint32Tag2 = "[object Uint32Array]";
  function initCloneByTag(object, tag, isDeep) {
    var Ctor = object.constructor;
    switch (tag) {
      case arrayBufferTag2:
        return cloneArrayBuffer_default(object);
      case boolTag2:
      case dateTag2:
        return new Ctor(+object);
      case dataViewTag3:
        return cloneDataView_default(object, isDeep);
      case float32Tag2:
      case float64Tag2:
      case int8Tag2:
      case int16Tag2:
      case int32Tag2:
      case uint8Tag2:
      case uint8ClampedTag2:
      case uint16Tag2:
      case uint32Tag2:
        return cloneTypedArray_default(object, isDeep);
      case mapTag3:
        return new Ctor();
      case numberTag2:
      case stringTag2:
        return new Ctor(object);
      case regexpTag2:
        return cloneRegExp_default(object);
      case setTag3:
        return new Ctor();
      case symbolTag:
        return cloneSymbol_default(object);
    }
  }
  var initCloneByTag_default = initCloneByTag;

  // node_modules/lodash-es/_initCloneObject.js
  function initCloneObject(object) {
    return typeof object.constructor == "function" && !isPrototype_default(object) ? baseCreate_default(getPrototype_default(object)) : {};
  }
  var initCloneObject_default = initCloneObject;

  // node_modules/lodash-es/_baseIsMap.js
  var mapTag4 = "[object Map]";
  function baseIsMap(value) {
    return isObjectLike_default(value) && getTag_default(value) == mapTag4;
  }
  var baseIsMap_default = baseIsMap;

  // node_modules/lodash-es/isMap.js
  var nodeIsMap = nodeUtil_default && nodeUtil_default.isMap;
  var isMap = nodeIsMap ? baseUnary_default(nodeIsMap) : baseIsMap_default;
  var isMap_default = isMap;

  // node_modules/lodash-es/_baseIsSet.js
  var setTag4 = "[object Set]";
  function baseIsSet(value) {
    return isObjectLike_default(value) && getTag_default(value) == setTag4;
  }
  var baseIsSet_default = baseIsSet;

  // node_modules/lodash-es/isSet.js
  var nodeIsSet = nodeUtil_default && nodeUtil_default.isSet;
  var isSet = nodeIsSet ? baseUnary_default(nodeIsSet) : baseIsSet_default;
  var isSet_default = isSet;

  // node_modules/lodash-es/_baseClone.js
  var CLONE_DEEP_FLAG = 1;
  var CLONE_FLAT_FLAG = 2;
  var CLONE_SYMBOLS_FLAG = 4;
  var argsTag3 = "[object Arguments]";
  var arrayTag2 = "[object Array]";
  var boolTag3 = "[object Boolean]";
  var dateTag3 = "[object Date]";
  var errorTag2 = "[object Error]";
  var funcTag3 = "[object Function]";
  var genTag2 = "[object GeneratorFunction]";
  var mapTag5 = "[object Map]";
  var numberTag3 = "[object Number]";
  var objectTag4 = "[object Object]";
  var regexpTag3 = "[object RegExp]";
  var setTag5 = "[object Set]";
  var stringTag3 = "[object String]";
  var symbolTag2 = "[object Symbol]";
  var weakMapTag3 = "[object WeakMap]";
  var arrayBufferTag3 = "[object ArrayBuffer]";
  var dataViewTag4 = "[object DataView]";
  var float32Tag3 = "[object Float32Array]";
  var float64Tag3 = "[object Float64Array]";
  var int8Tag3 = "[object Int8Array]";
  var int16Tag3 = "[object Int16Array]";
  var int32Tag3 = "[object Int32Array]";
  var uint8Tag3 = "[object Uint8Array]";
  var uint8ClampedTag3 = "[object Uint8ClampedArray]";
  var uint16Tag3 = "[object Uint16Array]";
  var uint32Tag3 = "[object Uint32Array]";
  var cloneableTags = {};
  cloneableTags[argsTag3] = cloneableTags[arrayTag2] = cloneableTags[arrayBufferTag3] = cloneableTags[dataViewTag4] = cloneableTags[boolTag3] = cloneableTags[dateTag3] = cloneableTags[float32Tag3] = cloneableTags[float64Tag3] = cloneableTags[int8Tag3] = cloneableTags[int16Tag3] = cloneableTags[int32Tag3] = cloneableTags[mapTag5] = cloneableTags[numberTag3] = cloneableTags[objectTag4] = cloneableTags[regexpTag3] = cloneableTags[setTag5] = cloneableTags[stringTag3] = cloneableTags[symbolTag2] = cloneableTags[uint8Tag3] = cloneableTags[uint8ClampedTag3] = cloneableTags[uint16Tag3] = cloneableTags[uint32Tag3] = true;
  cloneableTags[errorTag2] = cloneableTags[funcTag3] = cloneableTags[weakMapTag3] = false;
  function baseClone(value, bitmask, customizer, key, object, stack) {
    var result, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
    if (customizer) {
      result = object ? customizer(value, key, object, stack) : customizer(value);
    }
    if (result !== void 0) {
      return result;
    }
    if (!isObject_default(value)) {
      return value;
    }
    var isArr = isArray_default(value);
    if (isArr) {
      result = initCloneArray_default(value);
      if (!isDeep) {
        return copyArray_default(value, result);
      }
    } else {
      var tag = getTag_default(value), isFunc = tag == funcTag3 || tag == genTag2;
      if (isBuffer_default(value)) {
        return cloneBuffer_default(value, isDeep);
      }
      if (tag == objectTag4 || tag == argsTag3 || isFunc && !object) {
        result = isFlat || isFunc ? {} : initCloneObject_default(value);
        if (!isDeep) {
          return isFlat ? copySymbolsIn_default(value, baseAssignIn_default(result, value)) : copySymbols_default(value, baseAssign_default(result, value));
        }
      } else {
        if (!cloneableTags[tag]) {
          return object ? value : {};
        }
        result = initCloneByTag_default(value, tag, isDeep);
      }
    }
    stack || (stack = new Stack_default());
    var stacked = stack.get(value);
    if (stacked) {
      return stacked;
    }
    stack.set(value, result);
    if (isSet_default(value)) {
      value.forEach(function(subValue) {
        result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
      });
    } else if (isMap_default(value)) {
      value.forEach(function(subValue, key2) {
        result.set(key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
      });
    }
    var keysFunc = isFull ? isFlat ? getAllKeysIn_default : getAllKeys_default : isFlat ? keysIn_default : keys_default;
    var props = isArr ? void 0 : keysFunc(value);
    arrayEach_default(props || value, function(subValue, key2) {
      if (props) {
        key2 = subValue;
        subValue = value[key2];
      }
      assignValue_default(result, key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
    });
    return result;
  }
  var baseClone_default = baseClone;

  // node_modules/lodash-es/cloneDeep.js
  var CLONE_DEEP_FLAG2 = 1;
  var CLONE_SYMBOLS_FLAG2 = 4;
  function cloneDeep(value) {
    return baseClone_default(value, CLONE_DEEP_FLAG2 | CLONE_SYMBOLS_FLAG2);
  }
  var cloneDeep_default = cloneDeep;

  // node_modules/lodash-es/_setCacheAdd.js
  var HASH_UNDEFINED3 = "__lodash_hash_undefined__";
  function setCacheAdd(value) {
    this.__data__.set(value, HASH_UNDEFINED3);
    return this;
  }
  var setCacheAdd_default = setCacheAdd;

  // node_modules/lodash-es/_setCacheHas.js
  function setCacheHas(value) {
    return this.__data__.has(value);
  }
  var setCacheHas_default = setCacheHas;

  // node_modules/lodash-es/_SetCache.js
  function SetCache(values) {
    var index = -1, length = values == null ? 0 : values.length;
    this.__data__ = new MapCache_default();
    while (++index < length) {
      this.add(values[index]);
    }
  }
  SetCache.prototype.add = SetCache.prototype.push = setCacheAdd_default;
  SetCache.prototype.has = setCacheHas_default;
  var SetCache_default = SetCache;

  // node_modules/lodash-es/_arraySome.js
  function arraySome(array, predicate) {
    var index = -1, length = array == null ? 0 : array.length;
    while (++index < length) {
      if (predicate(array[index], index, array)) {
        return true;
      }
    }
    return false;
  }
  var arraySome_default = arraySome;

  // node_modules/lodash-es/_cacheHas.js
  function cacheHas(cache, key) {
    return cache.has(key);
  }
  var cacheHas_default = cacheHas;

  // node_modules/lodash-es/_equalArrays.js
  var COMPARE_PARTIAL_FLAG = 1;
  var COMPARE_UNORDERED_FLAG = 2;
  function equalArrays(array, other, bitmask, customizer, equalFunc, stack) {
    var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
    if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
      return false;
    }
    var arrStacked = stack.get(array);
    var othStacked = stack.get(other);
    if (arrStacked && othStacked) {
      return arrStacked == other && othStacked == array;
    }
    var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache_default() : void 0;
    stack.set(array, other);
    stack.set(other, array);
    while (++index < arrLength) {
      var arrValue = array[index], othValue = other[index];
      if (customizer) {
        var compared = isPartial ? customizer(othValue, arrValue, index, other, array, stack) : customizer(arrValue, othValue, index, array, other, stack);
      }
      if (compared !== void 0) {
        if (compared) {
          continue;
        }
        result = false;
        break;
      }
      if (seen) {
        if (!arraySome_default(other, function(othValue2, othIndex) {
          if (!cacheHas_default(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
            return seen.push(othIndex);
          }
        })) {
          result = false;
          break;
        }
      } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
        result = false;
        break;
      }
    }
    stack["delete"](array);
    stack["delete"](other);
    return result;
  }
  var equalArrays_default = equalArrays;

  // node_modules/lodash-es/_mapToArray.js
  function mapToArray(map) {
    var index = -1, result = Array(map.size);
    map.forEach(function(value, key) {
      result[++index] = [key, value];
    });
    return result;
  }
  var mapToArray_default = mapToArray;

  // node_modules/lodash-es/_setToArray.js
  function setToArray(set) {
    var index = -1, result = Array(set.size);
    set.forEach(function(value) {
      result[++index] = value;
    });
    return result;
  }
  var setToArray_default = setToArray;

  // node_modules/lodash-es/_equalByTag.js
  var COMPARE_PARTIAL_FLAG2 = 1;
  var COMPARE_UNORDERED_FLAG2 = 2;
  var boolTag4 = "[object Boolean]";
  var dateTag4 = "[object Date]";
  var errorTag3 = "[object Error]";
  var mapTag6 = "[object Map]";
  var numberTag4 = "[object Number]";
  var regexpTag4 = "[object RegExp]";
  var setTag6 = "[object Set]";
  var stringTag4 = "[object String]";
  var symbolTag3 = "[object Symbol]";
  var arrayBufferTag4 = "[object ArrayBuffer]";
  var dataViewTag5 = "[object DataView]";
  var symbolProto2 = Symbol_default ? Symbol_default.prototype : void 0;
  var symbolValueOf2 = symbolProto2 ? symbolProto2.valueOf : void 0;
  function equalByTag(object, other, tag, bitmask, customizer, equalFunc, stack) {
    switch (tag) {
      case dataViewTag5:
        if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
          return false;
        }
        object = object.buffer;
        other = other.buffer;
      case arrayBufferTag4:
        if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array_default(object), new Uint8Array_default(other))) {
          return false;
        }
        return true;
      case boolTag4:
      case dateTag4:
      case numberTag4:
        return eq_default(+object, +other);
      case errorTag3:
        return object.name == other.name && object.message == other.message;
      case regexpTag4:
      case stringTag4:
        return object == other + "";
      case mapTag6:
        var convert = mapToArray_default;
      case setTag6:
        var isPartial = bitmask & COMPARE_PARTIAL_FLAG2;
        convert || (convert = setToArray_default);
        if (object.size != other.size && !isPartial) {
          return false;
        }
        var stacked = stack.get(object);
        if (stacked) {
          return stacked == other;
        }
        bitmask |= COMPARE_UNORDERED_FLAG2;
        stack.set(object, other);
        var result = equalArrays_default(convert(object), convert(other), bitmask, customizer, equalFunc, stack);
        stack["delete"](object);
        return result;
      case symbolTag3:
        if (symbolValueOf2) {
          return symbolValueOf2.call(object) == symbolValueOf2.call(other);
        }
    }
    return false;
  }
  var equalByTag_default = equalByTag;

  // node_modules/lodash-es/_equalObjects.js
  var COMPARE_PARTIAL_FLAG3 = 1;
  var objectProto15 = Object.prototype;
  var hasOwnProperty12 = objectProto15.hasOwnProperty;
  function equalObjects(object, other, bitmask, customizer, equalFunc, stack) {
    var isPartial = bitmask & COMPARE_PARTIAL_FLAG3, objProps = getAllKeys_default(object), objLength = objProps.length, othProps = getAllKeys_default(other), othLength = othProps.length;
    if (objLength != othLength && !isPartial) {
      return false;
    }
    var index = objLength;
    while (index--) {
      var key = objProps[index];
      if (!(isPartial ? key in other : hasOwnProperty12.call(other, key))) {
        return false;
      }
    }
    var objStacked = stack.get(object);
    var othStacked = stack.get(other);
    if (objStacked && othStacked) {
      return objStacked == other && othStacked == object;
    }
    var result = true;
    stack.set(object, other);
    stack.set(other, object);
    var skipCtor = isPartial;
    while (++index < objLength) {
      key = objProps[index];
      var objValue = object[key], othValue = other[key];
      if (customizer) {
        var compared = isPartial ? customizer(othValue, objValue, key, other, object, stack) : customizer(objValue, othValue, key, object, other, stack);
      }
      if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
        result = false;
        break;
      }
      skipCtor || (skipCtor = key == "constructor");
    }
    if (result && !skipCtor) {
      var objCtor = object.constructor, othCtor = other.constructor;
      if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
        result = false;
      }
    }
    stack["delete"](object);
    stack["delete"](other);
    return result;
  }
  var equalObjects_default = equalObjects;

  // node_modules/lodash-es/_baseIsEqualDeep.js
  var COMPARE_PARTIAL_FLAG4 = 1;
  var argsTag4 = "[object Arguments]";
  var arrayTag3 = "[object Array]";
  var objectTag5 = "[object Object]";
  var objectProto16 = Object.prototype;
  var hasOwnProperty13 = objectProto16.hasOwnProperty;
  function baseIsEqualDeep(object, other, bitmask, customizer, equalFunc, stack) {
    var objIsArr = isArray_default(object), othIsArr = isArray_default(other), objTag = objIsArr ? arrayTag3 : getTag_default(object), othTag = othIsArr ? arrayTag3 : getTag_default(other);
    objTag = objTag == argsTag4 ? objectTag5 : objTag;
    othTag = othTag == argsTag4 ? objectTag5 : othTag;
    var objIsObj = objTag == objectTag5, othIsObj = othTag == objectTag5, isSameTag = objTag == othTag;
    if (isSameTag && isBuffer_default(object)) {
      if (!isBuffer_default(other)) {
        return false;
      }
      objIsArr = true;
      objIsObj = false;
    }
    if (isSameTag && !objIsObj) {
      stack || (stack = new Stack_default());
      return objIsArr || isTypedArray_default(object) ? equalArrays_default(object, other, bitmask, customizer, equalFunc, stack) : equalByTag_default(object, other, objTag, bitmask, customizer, equalFunc, stack);
    }
    if (!(bitmask & COMPARE_PARTIAL_FLAG4)) {
      var objIsWrapped = objIsObj && hasOwnProperty13.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty13.call(other, "__wrapped__");
      if (objIsWrapped || othIsWrapped) {
        var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
        stack || (stack = new Stack_default());
        return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
      }
    }
    if (!isSameTag) {
      return false;
    }
    stack || (stack = new Stack_default());
    return equalObjects_default(object, other, bitmask, customizer, equalFunc, stack);
  }
  var baseIsEqualDeep_default = baseIsEqualDeep;

  // node_modules/lodash-es/_baseIsEqual.js
  function baseIsEqual(value, other, bitmask, customizer, stack) {
    if (value === other) {
      return true;
    }
    if (value == null || other == null || !isObjectLike_default(value) && !isObjectLike_default(other)) {
      return value !== value && other !== other;
    }
    return baseIsEqualDeep_default(value, other, bitmask, customizer, baseIsEqual, stack);
  }
  var baseIsEqual_default = baseIsEqual;

  // node_modules/lodash-es/_createBaseFor.js
  function createBaseFor(fromRight) {
    return function(object, iteratee, keysFunc) {
      var index = -1, iterable = Object(object), props = keysFunc(object), length = props.length;
      while (length--) {
        var key = props[fromRight ? length : ++index];
        if (iteratee(iterable[key], key, iterable) === false) {
          break;
        }
      }
      return object;
    };
  }
  var createBaseFor_default = createBaseFor;

  // node_modules/lodash-es/_baseFor.js
  var baseFor = createBaseFor_default();
  var baseFor_default = baseFor;

  // node_modules/lodash-es/_assignMergeValue.js
  function assignMergeValue(object, key, value) {
    if (value !== void 0 && !eq_default(object[key], value) || value === void 0 && !(key in object)) {
      baseAssignValue_default(object, key, value);
    }
  }
  var assignMergeValue_default = assignMergeValue;

  // node_modules/lodash-es/isArrayLikeObject.js
  function isArrayLikeObject(value) {
    return isObjectLike_default(value) && isArrayLike_default(value);
  }
  var isArrayLikeObject_default = isArrayLikeObject;

  // node_modules/lodash-es/_safeGet.js
  function safeGet(object, key) {
    if (key === "constructor" && typeof object[key] === "function") {
      return;
    }
    if (key == "__proto__") {
      return;
    }
    return object[key];
  }
  var safeGet_default = safeGet;

  // node_modules/lodash-es/toPlainObject.js
  function toPlainObject(value) {
    return copyObject_default(value, keysIn_default(value));
  }
  var toPlainObject_default = toPlainObject;

  // node_modules/lodash-es/_baseMergeDeep.js
  function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
    var objValue = safeGet_default(object, key), srcValue = safeGet_default(source, key), stacked = stack.get(srcValue);
    if (stacked) {
      assignMergeValue_default(object, key, stacked);
      return;
    }
    var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : void 0;
    var isCommon = newValue === void 0;
    if (isCommon) {
      var isArr = isArray_default(srcValue), isBuff = !isArr && isBuffer_default(srcValue), isTyped = !isArr && !isBuff && isTypedArray_default(srcValue);
      newValue = srcValue;
      if (isArr || isBuff || isTyped) {
        if (isArray_default(objValue)) {
          newValue = objValue;
        } else if (isArrayLikeObject_default(objValue)) {
          newValue = copyArray_default(objValue);
        } else if (isBuff) {
          isCommon = false;
          newValue = cloneBuffer_default(srcValue, true);
        } else if (isTyped) {
          isCommon = false;
          newValue = cloneTypedArray_default(srcValue, true);
        } else {
          newValue = [];
        }
      } else if (isPlainObject_default(srcValue) || isArguments_default(srcValue)) {
        newValue = objValue;
        if (isArguments_default(objValue)) {
          newValue = toPlainObject_default(objValue);
        } else if (!isObject_default(objValue) || isFunction_default(objValue)) {
          newValue = initCloneObject_default(srcValue);
        }
      } else {
        isCommon = false;
      }
    }
    if (isCommon) {
      stack.set(srcValue, newValue);
      mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
      stack["delete"](srcValue);
    }
    assignMergeValue_default(object, key, newValue);
  }
  var baseMergeDeep_default = baseMergeDeep;

  // node_modules/lodash-es/_baseMerge.js
  function baseMerge(object, source, srcIndex, customizer, stack) {
    if (object === source) {
      return;
    }
    baseFor_default(source, function(srcValue, key) {
      stack || (stack = new Stack_default());
      if (isObject_default(srcValue)) {
        baseMergeDeep_default(object, source, key, srcIndex, baseMerge, customizer, stack);
      } else {
        var newValue = customizer ? customizer(safeGet_default(object, key), srcValue, key + "", object, source, stack) : void 0;
        if (newValue === void 0) {
          newValue = srcValue;
        }
        assignMergeValue_default(object, key, newValue);
      }
    }, keysIn_default);
  }
  var baseMerge_default = baseMerge;

  // node_modules/lodash-es/isEqual.js
  function isEqual(value, other) {
    return baseIsEqual_default(value, other);
  }
  var isEqual_default = isEqual;

  // node_modules/lodash-es/merge.js
  var merge = createAssigner_default(function(object, source, srcIndex) {
    baseMerge_default(object, source, srcIndex);
  });
  var merge_default = merge;

  // node_modules/parchment/dist/parchment.js
  var parchment_exports = {};
  __export(parchment_exports, {
    Attributor: () => Attributor,
    AttributorStore: () => AttributorStore$1,
    BlockBlot: () => BlockBlot$1,
    ClassAttributor: () => ClassAttributor$1,
    ContainerBlot: () => ContainerBlot$1,
    EmbedBlot: () => EmbedBlot$1,
    InlineBlot: () => InlineBlot$1,
    LeafBlot: () => LeafBlot$1,
    ParentBlot: () => ParentBlot$1,
    Registry: () => Registry,
    Scope: () => Scope,
    ScrollBlot: () => ScrollBlot$1,
    StyleAttributor: () => StyleAttributor$1,
    TextBlot: () => TextBlot$1
  });
  var Scope = /* @__PURE__ */ ((Scope2) => (Scope2[Scope2.TYPE = 3] = "TYPE", Scope2[Scope2.LEVEL = 12] = "LEVEL", Scope2[Scope2.ATTRIBUTE = 13] = "ATTRIBUTE", Scope2[Scope2.BLOT = 14] = "BLOT", Scope2[Scope2.INLINE = 7] = "INLINE", Scope2[Scope2.BLOCK = 11] = "BLOCK", Scope2[Scope2.BLOCK_BLOT = 10] = "BLOCK_BLOT", Scope2[Scope2.INLINE_BLOT = 6] = "INLINE_BLOT", Scope2[Scope2.BLOCK_ATTRIBUTE = 9] = "BLOCK_ATTRIBUTE", Scope2[Scope2.INLINE_ATTRIBUTE = 5] = "INLINE_ATTRIBUTE", Scope2[Scope2.ANY = 15] = "ANY", Scope2))(Scope || {});
  var Attributor = class {
    constructor(attrName, keyName, options = {}) {
      this.attrName = attrName, this.keyName = keyName;
      const attributeBit = Scope.TYPE & Scope.ATTRIBUTE;
      this.scope = options.scope != null ? (
        // Ignore type bits, force attribute bit
        options.scope & Scope.LEVEL | attributeBit
      ) : Scope.ATTRIBUTE, options.whitelist != null && (this.whitelist = options.whitelist);
    }
    static keys(node) {
      return Array.from(node.attributes).map((item) => item.name);
    }
    add(node, value) {
      return this.canAdd(node, value) ? (node.setAttribute(this.keyName, value), true) : false;
    }
    canAdd(_node, value) {
      return this.whitelist == null ? true : typeof value == "string" ? this.whitelist.indexOf(value.replace(/["']/g, "")) > -1 : this.whitelist.indexOf(value) > -1;
    }
    remove(node) {
      node.removeAttribute(this.keyName);
    }
    value(node) {
      const value = node.getAttribute(this.keyName);
      return this.canAdd(node, value) && value ? value : "";
    }
  };
  var ParchmentError = class extends Error {
    constructor(message) {
      message = "[Parchment] " + message, super(message), this.message = message, this.name = this.constructor.name;
    }
  };
  var _Registry = class _Registry2 {
    constructor() {
      this.attributes = {}, this.classes = {}, this.tags = {}, this.types = {};
    }
    static find(node, bubble = false) {
      if (node == null)
        return null;
      if (this.blots.has(node))
        return this.blots.get(node) || null;
      if (bubble) {
        let parentNode = null;
        try {
          parentNode = node.parentNode;
        } catch {
          return null;
        }
        return this.find(parentNode, bubble);
      }
      return null;
    }
    create(scroll, input, value) {
      const match2 = this.query(input);
      if (match2 == null)
        throw new ParchmentError(`Unable to create ${input} blot`);
      const blotClass = match2, node = (
        // @ts-expect-error Fix me later
        input instanceof Node || input.nodeType === Node.TEXT_NODE ? input : blotClass.create(value)
      ), blot = new blotClass(scroll, node, value);
      return _Registry2.blots.set(blot.domNode, blot), blot;
    }
    find(node, bubble = false) {
      return _Registry2.find(node, bubble);
    }
    query(query, scope = Scope.ANY) {
      let match2;
      return typeof query == "string" ? match2 = this.types[query] || this.attributes[query] : query instanceof Text || query.nodeType === Node.TEXT_NODE ? match2 = this.types.text : typeof query == "number" ? query & Scope.LEVEL & Scope.BLOCK ? match2 = this.types.block : query & Scope.LEVEL & Scope.INLINE && (match2 = this.types.inline) : query instanceof Element && ((query.getAttribute("class") || "").split(/\s+/).some((name) => (match2 = this.classes[name], !!match2)), match2 = match2 || this.tags[query.tagName]), match2 == null ? null : "scope" in match2 && scope & Scope.LEVEL & match2.scope && scope & Scope.TYPE & match2.scope ? match2 : null;
    }
    register(...definitions) {
      return definitions.map((definition) => {
        const isBlot = "blotName" in definition, isAttr = "attrName" in definition;
        if (!isBlot && !isAttr)
          throw new ParchmentError("Invalid definition");
        if (isBlot && definition.blotName === "abstract")
          throw new ParchmentError("Cannot register abstract class");
        const key = isBlot ? definition.blotName : isAttr ? definition.attrName : void 0;
        return this.types[key] = definition, isAttr ? typeof definition.keyName == "string" && (this.attributes[definition.keyName] = definition) : isBlot && (definition.className && (this.classes[definition.className] = definition), definition.tagName && (Array.isArray(definition.tagName) ? definition.tagName = definition.tagName.map((tagName) => tagName.toUpperCase()) : definition.tagName = definition.tagName.toUpperCase(), (Array.isArray(definition.tagName) ? definition.tagName : [definition.tagName]).forEach((tag) => {
          (this.tags[tag] == null || definition.className == null) && (this.tags[tag] = definition);
        }))), definition;
      });
    }
  };
  _Registry.blots = /* @__PURE__ */ new WeakMap();
  var Registry = _Registry;
  function match(node, prefix) {
    return (node.getAttribute("class") || "").split(/\s+/).filter((name) => name.indexOf(`${prefix}-`) === 0);
  }
  var ClassAttributor = class extends Attributor {
    static keys(node) {
      return (node.getAttribute("class") || "").split(/\s+/).map((name) => name.split("-").slice(0, -1).join("-"));
    }
    add(node, value) {
      return this.canAdd(node, value) ? (this.remove(node), node.classList.add(`${this.keyName}-${value}`), true) : false;
    }
    remove(node) {
      match(node, this.keyName).forEach((name) => {
        node.classList.remove(name);
      }), node.classList.length === 0 && node.removeAttribute("class");
    }
    value(node) {
      const value = (match(node, this.keyName)[0] || "").slice(this.keyName.length + 1);
      return this.canAdd(node, value) ? value : "";
    }
  };
  var ClassAttributor$1 = ClassAttributor;
  function camelize(name) {
    const parts = name.split("-"), rest = parts.slice(1).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
    return parts[0] + rest;
  }
  var StyleAttributor = class extends Attributor {
    static keys(node) {
      return (node.getAttribute("style") || "").split(";").map((value) => value.split(":")[0].trim());
    }
    add(node, value) {
      return this.canAdd(node, value) ? (node.style[camelize(this.keyName)] = value, true) : false;
    }
    remove(node) {
      node.style[camelize(this.keyName)] = "", node.getAttribute("style") || node.removeAttribute("style");
    }
    value(node) {
      const value = node.style[camelize(this.keyName)];
      return this.canAdd(node, value) ? value : "";
    }
  };
  var StyleAttributor$1 = StyleAttributor;
  var AttributorStore = class {
    constructor(domNode) {
      this.attributes = {}, this.domNode = domNode, this.build();
    }
    attribute(attribute, value) {
      value ? attribute.add(this.domNode, value) && (attribute.value(this.domNode) != null ? this.attributes[attribute.attrName] = attribute : delete this.attributes[attribute.attrName]) : (attribute.remove(this.domNode), delete this.attributes[attribute.attrName]);
    }
    build() {
      this.attributes = {};
      const blot = Registry.find(this.domNode);
      if (blot == null)
        return;
      const attributes = Attributor.keys(this.domNode), classes = ClassAttributor$1.keys(this.domNode), styles = StyleAttributor$1.keys(this.domNode);
      attributes.concat(classes).concat(styles).forEach((name) => {
        const attr = blot.scroll.query(name, Scope.ATTRIBUTE);
        attr instanceof Attributor && (this.attributes[attr.attrName] = attr);
      });
    }
    copy(target) {
      Object.keys(this.attributes).forEach((key) => {
        const value = this.attributes[key].value(this.domNode);
        target.format(key, value);
      });
    }
    move(target) {
      this.copy(target), Object.keys(this.attributes).forEach((key) => {
        this.attributes[key].remove(this.domNode);
      }), this.attributes = {};
    }
    values() {
      return Object.keys(this.attributes).reduce(
        (attributes, name) => (attributes[name] = this.attributes[name].value(this.domNode), attributes),
        {}
      );
    }
  };
  var AttributorStore$1 = AttributorStore;
  var _ShadowBlot = class _ShadowBlot2 {
    constructor(scroll, domNode) {
      this.scroll = scroll, this.domNode = domNode, Registry.blots.set(domNode, this), this.prev = null, this.next = null;
    }
    static create(rawValue) {
      if (this.tagName == null)
        throw new ParchmentError("Blot definition missing tagName");
      let node, value;
      return Array.isArray(this.tagName) ? (typeof rawValue == "string" ? (value = rawValue.toUpperCase(), parseInt(value, 10).toString() === value && (value = parseInt(value, 10))) : typeof rawValue == "number" && (value = rawValue), typeof value == "number" ? node = document.createElement(this.tagName[value - 1]) : value && this.tagName.indexOf(value) > -1 ? node = document.createElement(value) : node = document.createElement(this.tagName[0])) : node = document.createElement(this.tagName), this.className && node.classList.add(this.className), node;
    }
    // Hack for accessing inherited static methods
    get statics() {
      return this.constructor;
    }
    attach() {
    }
    clone() {
      const domNode = this.domNode.cloneNode(false);
      return this.scroll.create(domNode);
    }
    detach() {
      this.parent != null && this.parent.removeChild(this), Registry.blots.delete(this.domNode);
    }
    deleteAt(index, length) {
      this.isolate(index, length).remove();
    }
    formatAt(index, length, name, value) {
      const blot = this.isolate(index, length);
      if (this.scroll.query(name, Scope.BLOT) != null && value)
        blot.wrap(name, value);
      else if (this.scroll.query(name, Scope.ATTRIBUTE) != null) {
        const parent = this.scroll.create(this.statics.scope);
        blot.wrap(parent), parent.format(name, value);
      }
    }
    insertAt(index, value, def) {
      const blot = def == null ? this.scroll.create("text", value) : this.scroll.create(value, def), ref = this.split(index);
      this.parent.insertBefore(blot, ref || void 0);
    }
    isolate(index, length) {
      const target = this.split(index);
      if (target == null)
        throw new Error("Attempt to isolate at end");
      return target.split(length), target;
    }
    length() {
      return 1;
    }
    offset(root2 = this.parent) {
      return this.parent == null || this === root2 ? 0 : this.parent.children.offset(this) + this.parent.offset(root2);
    }
    optimize(_context) {
      this.statics.requiredContainer && !(this.parent instanceof this.statics.requiredContainer) && this.wrap(this.statics.requiredContainer.blotName);
    }
    remove() {
      this.domNode.parentNode != null && this.domNode.parentNode.removeChild(this.domNode), this.detach();
    }
    replaceWith(name, value) {
      const replacement = typeof name == "string" ? this.scroll.create(name, value) : name;
      return this.parent != null && (this.parent.insertBefore(replacement, this.next || void 0), this.remove()), replacement;
    }
    split(index, _force) {
      return index === 0 ? this : this.next;
    }
    update(_mutations, _context) {
    }
    wrap(name, value) {
      const wrapper = typeof name == "string" ? this.scroll.create(name, value) : name;
      if (this.parent != null && this.parent.insertBefore(wrapper, this.next || void 0), typeof wrapper.appendChild != "function")
        throw new ParchmentError(`Cannot wrap ${name}`);
      return wrapper.appendChild(this), wrapper;
    }
  };
  _ShadowBlot.blotName = "abstract";
  var ShadowBlot = _ShadowBlot;
  var _LeafBlot = class _LeafBlot2 extends ShadowBlot {
    /**
     * Returns the value represented by domNode if it is this Blot's type
     * No checking that domNode can represent this Blot type is required so
     * applications needing it should check externally before calling.
     */
    static value(_domNode) {
      return true;
    }
    /**
     * Given location represented by node and offset from DOM Selection Range,
     * return index to that location.
     */
    index(node, offset) {
      return this.domNode === node || this.domNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY ? Math.min(offset, 1) : -1;
    }
    /**
     * Given index to location within blot, return node and offset representing
     * that location, consumable by DOM Selection Range
     */
    position(index, _inclusive) {
      let offset = Array.from(this.parent.domNode.childNodes).indexOf(this.domNode);
      return index > 0 && (offset += 1), [this.parent.domNode, offset];
    }
    /**
     * Return value represented by this blot
     * Should not change without interaction from API or
     * user change detectable by update()
     */
    value() {
      return {
        [this.statics.blotName]: this.statics.value(this.domNode) || true
      };
    }
  };
  _LeafBlot.scope = Scope.INLINE_BLOT;
  var LeafBlot = _LeafBlot;
  var LeafBlot$1 = LeafBlot;
  var LinkedList = class {
    constructor() {
      this.head = null, this.tail = null, this.length = 0;
    }
    append(...nodes) {
      if (this.insertBefore(nodes[0], null), nodes.length > 1) {
        const rest = nodes.slice(1);
        this.append(...rest);
      }
    }
    at(index) {
      const next = this.iterator();
      let cur = next();
      for (; cur && index > 0; )
        index -= 1, cur = next();
      return cur;
    }
    contains(node) {
      const next = this.iterator();
      let cur = next();
      for (; cur; ) {
        if (cur === node)
          return true;
        cur = next();
      }
      return false;
    }
    indexOf(node) {
      const next = this.iterator();
      let cur = next(), index = 0;
      for (; cur; ) {
        if (cur === node)
          return index;
        index += 1, cur = next();
      }
      return -1;
    }
    insertBefore(node, refNode) {
      node != null && (this.remove(node), node.next = refNode, refNode != null ? (node.prev = refNode.prev, refNode.prev != null && (refNode.prev.next = node), refNode.prev = node, refNode === this.head && (this.head = node)) : this.tail != null ? (this.tail.next = node, node.prev = this.tail, this.tail = node) : (node.prev = null, this.head = this.tail = node), this.length += 1);
    }
    offset(target) {
      let index = 0, cur = this.head;
      for (; cur != null; ) {
        if (cur === target)
          return index;
        index += cur.length(), cur = cur.next;
      }
      return -1;
    }
    remove(node) {
      this.contains(node) && (node.prev != null && (node.prev.next = node.next), node.next != null && (node.next.prev = node.prev), node === this.head && (this.head = node.next), node === this.tail && (this.tail = node.prev), this.length -= 1);
    }
    iterator(curNode = this.head) {
      return () => {
        const ret = curNode;
        return curNode != null && (curNode = curNode.next), ret;
      };
    }
    find(index, inclusive = false) {
      const next = this.iterator();
      let cur = next();
      for (; cur; ) {
        const length = cur.length();
        if (index < length || inclusive && index === length && (cur.next == null || cur.next.length() !== 0))
          return [cur, index];
        index -= length, cur = next();
      }
      return [null, 0];
    }
    forEach(callback) {
      const next = this.iterator();
      let cur = next();
      for (; cur; )
        callback(cur), cur = next();
    }
    forEachAt(index, length, callback) {
      if (length <= 0)
        return;
      const [startNode, offset] = this.find(index);
      let curIndex = index - offset;
      const next = this.iterator(startNode);
      let cur = next();
      for (; cur && curIndex < index + length; ) {
        const curLength = cur.length();
        index > curIndex ? callback(
          cur,
          index - curIndex,
          Math.min(length, curIndex + curLength - index)
        ) : callback(cur, 0, Math.min(curLength, index + length - curIndex)), curIndex += curLength, cur = next();
      }
    }
    map(callback) {
      return this.reduce((memo, cur) => (memo.push(callback(cur)), memo), []);
    }
    reduce(callback, memo) {
      const next = this.iterator();
      let cur = next();
      for (; cur; )
        memo = callback(memo, cur), cur = next();
      return memo;
    }
  };
  function makeAttachedBlot(node, scroll) {
    const found = scroll.find(node);
    if (found)
      return found;
    try {
      return scroll.create(node);
    } catch {
      const blot = scroll.create(Scope.INLINE);
      return Array.from(node.childNodes).forEach((child) => {
        blot.domNode.appendChild(child);
      }), node.parentNode && node.parentNode.replaceChild(blot.domNode, node), blot.attach(), blot;
    }
  }
  var _ParentBlot = class _ParentBlot2 extends ShadowBlot {
    constructor(scroll, domNode) {
      super(scroll, domNode), this.uiNode = null, this.build();
    }
    appendChild(other) {
      this.insertBefore(other);
    }
    attach() {
      super.attach(), this.children.forEach((child) => {
        child.attach();
      });
    }
    attachUI(node) {
      this.uiNode != null && this.uiNode.remove(), this.uiNode = node, _ParentBlot2.uiClass && this.uiNode.classList.add(_ParentBlot2.uiClass), this.uiNode.setAttribute("contenteditable", "false"), this.domNode.insertBefore(this.uiNode, this.domNode.firstChild);
    }
    /**
     * Called during construction, should fill its own children LinkedList.
     */
    build() {
      this.children = new LinkedList(), Array.from(this.domNode.childNodes).filter((node) => node !== this.uiNode).reverse().forEach((node) => {
        try {
          const child = makeAttachedBlot(node, this.scroll);
          this.insertBefore(child, this.children.head || void 0);
        } catch (err) {
          if (err instanceof ParchmentError)
            return;
          throw err;
        }
      });
    }
    deleteAt(index, length) {
      if (index === 0 && length === this.length())
        return this.remove();
      this.children.forEachAt(index, length, (child, offset, childLength) => {
        child.deleteAt(offset, childLength);
      });
    }
    descendant(criteria, index = 0) {
      const [child, offset] = this.children.find(index);
      return criteria.blotName == null && criteria(child) || criteria.blotName != null && child instanceof criteria ? [child, offset] : child instanceof _ParentBlot2 ? child.descendant(criteria, offset) : [null, -1];
    }
    descendants(criteria, index = 0, length = Number.MAX_VALUE) {
      let descendants = [], lengthLeft = length;
      return this.children.forEachAt(
        index,
        length,
        (child, childIndex, childLength) => {
          (criteria.blotName == null && criteria(child) || criteria.blotName != null && child instanceof criteria) && descendants.push(child), child instanceof _ParentBlot2 && (descendants = descendants.concat(
            child.descendants(criteria, childIndex, lengthLeft)
          )), lengthLeft -= childLength;
        }
      ), descendants;
    }
    detach() {
      this.children.forEach((child) => {
        child.detach();
      }), super.detach();
    }
    enforceAllowedChildren() {
      let done = false;
      this.children.forEach((child) => {
        done || this.statics.allowedChildren.some(
          (def) => child instanceof def
        ) || (child.statics.scope === Scope.BLOCK_BLOT ? (child.next != null && this.splitAfter(child), child.prev != null && this.splitAfter(child.prev), child.parent.unwrap(), done = true) : child instanceof _ParentBlot2 ? child.unwrap() : child.remove());
      });
    }
    formatAt(index, length, name, value) {
      this.children.forEachAt(index, length, (child, offset, childLength) => {
        child.formatAt(offset, childLength, name, value);
      });
    }
    insertAt(index, value, def) {
      const [child, offset] = this.children.find(index);
      if (child)
        child.insertAt(offset, value, def);
      else {
        const blot = def == null ? this.scroll.create("text", value) : this.scroll.create(value, def);
        this.appendChild(blot);
      }
    }
    insertBefore(childBlot, refBlot) {
      childBlot.parent != null && childBlot.parent.children.remove(childBlot);
      let refDomNode = null;
      this.children.insertBefore(childBlot, refBlot || null), childBlot.parent = this, refBlot != null && (refDomNode = refBlot.domNode), (this.domNode.parentNode !== childBlot.domNode || this.domNode.nextSibling !== refDomNode) && this.domNode.insertBefore(childBlot.domNode, refDomNode), childBlot.attach();
    }
    length() {
      return this.children.reduce((memo, child) => memo + child.length(), 0);
    }
    moveChildren(targetParent, refNode) {
      this.children.forEach((child) => {
        targetParent.insertBefore(child, refNode);
      });
    }
    optimize(context) {
      if (super.optimize(context), this.enforceAllowedChildren(), this.uiNode != null && this.uiNode !== this.domNode.firstChild && this.domNode.insertBefore(this.uiNode, this.domNode.firstChild), this.children.length === 0)
        if (this.statics.defaultChild != null) {
          const child = this.scroll.create(this.statics.defaultChild.blotName);
          this.appendChild(child);
        } else
          this.remove();
    }
    path(index, inclusive = false) {
      const [child, offset] = this.children.find(index, inclusive), position = [[this, index]];
      return child instanceof _ParentBlot2 ? position.concat(child.path(offset, inclusive)) : (child != null && position.push([child, offset]), position);
    }
    removeChild(child) {
      this.children.remove(child);
    }
    replaceWith(name, value) {
      const replacement = typeof name == "string" ? this.scroll.create(name, value) : name;
      return replacement instanceof _ParentBlot2 && this.moveChildren(replacement), super.replaceWith(replacement);
    }
    split(index, force = false) {
      if (!force) {
        if (index === 0)
          return this;
        if (index === this.length())
          return this.next;
      }
      const after = this.clone();
      return this.parent && this.parent.insertBefore(after, this.next || void 0), this.children.forEachAt(index, this.length(), (child, offset, _length) => {
        const split = child.split(offset, force);
        split != null && after.appendChild(split);
      }), after;
    }
    splitAfter(child) {
      const after = this.clone();
      for (; child.next != null; )
        after.appendChild(child.next);
      return this.parent && this.parent.insertBefore(after, this.next || void 0), after;
    }
    unwrap() {
      this.parent && this.moveChildren(this.parent, this.next || void 0), this.remove();
    }
    update(mutations, _context) {
      const addedNodes = [], removedNodes = [];
      mutations.forEach((mutation) => {
        mutation.target === this.domNode && mutation.type === "childList" && (addedNodes.push(...mutation.addedNodes), removedNodes.push(...mutation.removedNodes));
      }), removedNodes.forEach((node) => {
        if (node.parentNode != null && // @ts-expect-error Fix me later
        node.tagName !== "IFRAME" && document.body.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_CONTAINED_BY)
          return;
        const blot = this.scroll.find(node);
        blot != null && (blot.domNode.parentNode == null || blot.domNode.parentNode === this.domNode) && blot.detach();
      }), addedNodes.filter((node) => node.parentNode === this.domNode && node !== this.uiNode).sort((a, b) => a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1).forEach((node) => {
        let refBlot = null;
        node.nextSibling != null && (refBlot = this.scroll.find(node.nextSibling));
        const blot = makeAttachedBlot(node, this.scroll);
        (blot.next !== refBlot || blot.next == null) && (blot.parent != null && blot.parent.removeChild(this), this.insertBefore(blot, refBlot || void 0));
      }), this.enforceAllowedChildren();
    }
  };
  _ParentBlot.uiClass = "";
  var ParentBlot = _ParentBlot;
  var ParentBlot$1 = ParentBlot;
  function isEqual2(obj1, obj2) {
    if (Object.keys(obj1).length !== Object.keys(obj2).length)
      return false;
    for (const prop in obj1)
      if (obj1[prop] !== obj2[prop])
        return false;
    return true;
  }
  var _InlineBlot = class _InlineBlot2 extends ParentBlot$1 {
    static create(value) {
      return super.create(value);
    }
    static formats(domNode, scroll) {
      const match2 = scroll.query(_InlineBlot2.blotName);
      if (!(match2 != null && domNode.tagName === match2.tagName)) {
        if (typeof this.tagName == "string")
          return true;
        if (Array.isArray(this.tagName))
          return domNode.tagName.toLowerCase();
      }
    }
    constructor(scroll, domNode) {
      super(scroll, domNode), this.attributes = new AttributorStore$1(this.domNode);
    }
    format(name, value) {
      if (name === this.statics.blotName && !value)
        this.children.forEach((child) => {
          child instanceof _InlineBlot2 || (child = child.wrap(_InlineBlot2.blotName, true)), this.attributes.copy(child);
        }), this.unwrap();
      else {
        const format = this.scroll.query(name, Scope.INLINE);
        if (format == null)
          return;
        format instanceof Attributor ? this.attributes.attribute(format, value) : value && (name !== this.statics.blotName || this.formats()[name] !== value) && this.replaceWith(name, value);
      }
    }
    formats() {
      const formats = this.attributes.values(), format = this.statics.formats(this.domNode, this.scroll);
      return format != null && (formats[this.statics.blotName] = format), formats;
    }
    formatAt(index, length, name, value) {
      this.formats()[name] != null || this.scroll.query(name, Scope.ATTRIBUTE) ? this.isolate(index, length).format(name, value) : super.formatAt(index, length, name, value);
    }
    optimize(context) {
      super.optimize(context);
      const formats = this.formats();
      if (Object.keys(formats).length === 0)
        return this.unwrap();
      const next = this.next;
      next instanceof _InlineBlot2 && next.prev === this && isEqual2(formats, next.formats()) && (next.moveChildren(this), next.remove());
    }
    replaceWith(name, value) {
      const replacement = super.replaceWith(name, value);
      return this.attributes.copy(replacement), replacement;
    }
    update(mutations, context) {
      super.update(mutations, context), mutations.some(
        (mutation) => mutation.target === this.domNode && mutation.type === "attributes"
      ) && this.attributes.build();
    }
    wrap(name, value) {
      const wrapper = super.wrap(name, value);
      return wrapper instanceof _InlineBlot2 && this.attributes.move(wrapper), wrapper;
    }
  };
  _InlineBlot.allowedChildren = [_InlineBlot, LeafBlot$1], _InlineBlot.blotName = "inline", _InlineBlot.scope = Scope.INLINE_BLOT, _InlineBlot.tagName = "SPAN";
  var InlineBlot = _InlineBlot;
  var InlineBlot$1 = InlineBlot;
  var _BlockBlot = class _BlockBlot2 extends ParentBlot$1 {
    static create(value) {
      return super.create(value);
    }
    static formats(domNode, scroll) {
      const match2 = scroll.query(_BlockBlot2.blotName);
      if (!(match2 != null && domNode.tagName === match2.tagName)) {
        if (typeof this.tagName == "string")
          return true;
        if (Array.isArray(this.tagName))
          return domNode.tagName.toLowerCase();
      }
    }
    constructor(scroll, domNode) {
      super(scroll, domNode), this.attributes = new AttributorStore$1(this.domNode);
    }
    format(name, value) {
      const format = this.scroll.query(name, Scope.BLOCK);
      format != null && (format instanceof Attributor ? this.attributes.attribute(format, value) : name === this.statics.blotName && !value ? this.replaceWith(_BlockBlot2.blotName) : value && (name !== this.statics.blotName || this.formats()[name] !== value) && this.replaceWith(name, value));
    }
    formats() {
      const formats = this.attributes.values(), format = this.statics.formats(this.domNode, this.scroll);
      return format != null && (formats[this.statics.blotName] = format), formats;
    }
    formatAt(index, length, name, value) {
      this.scroll.query(name, Scope.BLOCK) != null ? this.format(name, value) : super.formatAt(index, length, name, value);
    }
    insertAt(index, value, def) {
      if (def == null || this.scroll.query(value, Scope.INLINE) != null)
        super.insertAt(index, value, def);
      else {
        const after = this.split(index);
        if (after != null) {
          const blot = this.scroll.create(value, def);
          after.parent.insertBefore(blot, after);
        } else
          throw new Error("Attempt to insertAt after block boundaries");
      }
    }
    replaceWith(name, value) {
      const replacement = super.replaceWith(name, value);
      return this.attributes.copy(replacement), replacement;
    }
    update(mutations, context) {
      super.update(mutations, context), mutations.some(
        (mutation) => mutation.target === this.domNode && mutation.type === "attributes"
      ) && this.attributes.build();
    }
  };
  _BlockBlot.blotName = "block", _BlockBlot.scope = Scope.BLOCK_BLOT, _BlockBlot.tagName = "P", _BlockBlot.allowedChildren = [
    InlineBlot$1,
    _BlockBlot,
    LeafBlot$1
  ];
  var BlockBlot = _BlockBlot;
  var BlockBlot$1 = BlockBlot;
  var _ContainerBlot = class _ContainerBlot2 extends ParentBlot$1 {
    checkMerge() {
      return this.next !== null && this.next.statics.blotName === this.statics.blotName;
    }
    deleteAt(index, length) {
      super.deleteAt(index, length), this.enforceAllowedChildren();
    }
    formatAt(index, length, name, value) {
      super.formatAt(index, length, name, value), this.enforceAllowedChildren();
    }
    insertAt(index, value, def) {
      super.insertAt(index, value, def), this.enforceAllowedChildren();
    }
    optimize(context) {
      super.optimize(context), this.children.length > 0 && this.next != null && this.checkMerge() && (this.next.moveChildren(this), this.next.remove());
    }
  };
  _ContainerBlot.blotName = "container", _ContainerBlot.scope = Scope.BLOCK_BLOT;
  var ContainerBlot = _ContainerBlot;
  var ContainerBlot$1 = ContainerBlot;
  var EmbedBlot = class extends LeafBlot$1 {
    static formats(_domNode, _scroll) {
    }
    format(name, value) {
      super.formatAt(0, this.length(), name, value);
    }
    formatAt(index, length, name, value) {
      index === 0 && length === this.length() ? this.format(name, value) : super.formatAt(index, length, name, value);
    }
    formats() {
      return this.statics.formats(this.domNode, this.scroll);
    }
  };
  var EmbedBlot$1 = EmbedBlot;
  var OBSERVER_CONFIG = {
    attributes: true,
    characterData: true,
    characterDataOldValue: true,
    childList: true,
    subtree: true
  };
  var MAX_OPTIMIZE_ITERATIONS = 100;
  var _ScrollBlot = class _ScrollBlot2 extends ParentBlot$1 {
    constructor(registry, node) {
      super(null, node), this.registry = registry, this.scroll = this, this.build(), this.observer = new MutationObserver((mutations) => {
        this.update(mutations);
      }), this.observer.observe(this.domNode, OBSERVER_CONFIG), this.attach();
    }
    create(input, value) {
      return this.registry.create(this, input, value);
    }
    find(node, bubble = false) {
      const blot = this.registry.find(node, bubble);
      return blot ? blot.scroll === this ? blot : bubble ? this.find(blot.scroll.domNode.parentNode, true) : null : null;
    }
    query(query, scope = Scope.ANY) {
      return this.registry.query(query, scope);
    }
    register(...definitions) {
      return this.registry.register(...definitions);
    }
    build() {
      this.scroll != null && super.build();
    }
    detach() {
      super.detach(), this.observer.disconnect();
    }
    deleteAt(index, length) {
      this.update(), index === 0 && length === this.length() ? this.children.forEach((child) => {
        child.remove();
      }) : super.deleteAt(index, length);
    }
    formatAt(index, length, name, value) {
      this.update(), super.formatAt(index, length, name, value);
    }
    insertAt(index, value, def) {
      this.update(), super.insertAt(index, value, def);
    }
    optimize(mutations = [], context = {}) {
      super.optimize(context);
      const mutationsMap = context.mutationsMap || /* @__PURE__ */ new WeakMap();
      let records = Array.from(this.observer.takeRecords());
      for (; records.length > 0; )
        mutations.push(records.pop());
      const mark = (blot, markParent = true) => {
        blot == null || blot === this || blot.domNode.parentNode != null && (mutationsMap.has(blot.domNode) || mutationsMap.set(blot.domNode, []), markParent && mark(blot.parent));
      }, optimize = (blot) => {
        mutationsMap.has(blot.domNode) && (blot instanceof ParentBlot$1 && blot.children.forEach(optimize), mutationsMap.delete(blot.domNode), blot.optimize(context));
      };
      let remaining = mutations;
      for (let i = 0; remaining.length > 0; i += 1) {
        if (i >= MAX_OPTIMIZE_ITERATIONS)
          throw new Error("[Parchment] Maximum optimize iterations reached");
        for (remaining.forEach((mutation) => {
          const blot = this.find(mutation.target, true);
          blot != null && (blot.domNode === mutation.target && (mutation.type === "childList" ? (mark(this.find(mutation.previousSibling, false)), Array.from(mutation.addedNodes).forEach((node) => {
            const child = this.find(node, false);
            mark(child, false), child instanceof ParentBlot$1 && child.children.forEach((grandChild) => {
              mark(grandChild, false);
            });
          })) : mutation.type === "attributes" && mark(blot.prev)), mark(blot));
        }), this.children.forEach(optimize), remaining = Array.from(this.observer.takeRecords()), records = remaining.slice(); records.length > 0; )
          mutations.push(records.pop());
      }
    }
    update(mutations, context = {}) {
      mutations = mutations || this.observer.takeRecords();
      const mutationsMap = /* @__PURE__ */ new WeakMap();
      mutations.map((mutation) => {
        const blot = this.find(mutation.target, true);
        return blot == null ? null : mutationsMap.has(blot.domNode) ? (mutationsMap.get(blot.domNode).push(mutation), null) : (mutationsMap.set(blot.domNode, [mutation]), blot);
      }).forEach((blot) => {
        blot != null && blot !== this && mutationsMap.has(blot.domNode) && blot.update(mutationsMap.get(blot.domNode) || [], context);
      }), context.mutationsMap = mutationsMap, mutationsMap.has(this.domNode) && super.update(mutationsMap.get(this.domNode), context), this.optimize(mutations, context);
    }
  };
  _ScrollBlot.blotName = "scroll", _ScrollBlot.defaultChild = BlockBlot$1, _ScrollBlot.allowedChildren = [BlockBlot$1, ContainerBlot$1], _ScrollBlot.scope = Scope.BLOCK_BLOT, _ScrollBlot.tagName = "DIV";
  var ScrollBlot = _ScrollBlot;
  var ScrollBlot$1 = ScrollBlot;
  var _TextBlot = class _TextBlot2 extends LeafBlot$1 {
    static create(value) {
      return document.createTextNode(value);
    }
    static value(domNode) {
      return domNode.data;
    }
    constructor(scroll, node) {
      super(scroll, node), this.text = this.statics.value(this.domNode);
    }
    deleteAt(index, length) {
      this.domNode.data = this.text = this.text.slice(0, index) + this.text.slice(index + length);
    }
    index(node, offset) {
      return this.domNode === node ? offset : -1;
    }
    insertAt(index, value, def) {
      def == null ? (this.text = this.text.slice(0, index) + value + this.text.slice(index), this.domNode.data = this.text) : super.insertAt(index, value, def);
    }
    length() {
      return this.text.length;
    }
    optimize(context) {
      super.optimize(context), this.text = this.statics.value(this.domNode), this.text.length === 0 ? this.remove() : this.next instanceof _TextBlot2 && this.next.prev === this && (this.insertAt(this.length(), this.next.value()), this.next.remove());
    }
    position(index, _inclusive = false) {
      return [this.domNode, index];
    }
    split(index, force = false) {
      if (!force) {
        if (index === 0)
          return this;
        if (index === this.length())
          return this.next;
      }
      const after = this.scroll.create(this.domNode.splitText(index));
      return this.parent.insertBefore(after, this.next || void 0), this.text = this.statics.value(this.domNode), after;
    }
    update(mutations, _context) {
      mutations.some((mutation) => mutation.type === "characterData" && mutation.target === this.domNode) && (this.text = this.statics.value(this.domNode));
    }
    value() {
      return this.text;
    }
  };
  _TextBlot.blotName = "text", _TextBlot.scope = Scope.INLINE_BLOT;
  var TextBlot = _TextBlot;
  var TextBlot$1 = TextBlot;

  // node_modules/quill/core/quill.js
  var import_quill_delta3 = __toESM(require_Delta(), 1);

  // node_modules/quill/core/editor.js
  var import_quill_delta2 = __toESM(require_Delta(), 1);

  // node_modules/quill/blots/block.js
  var import_quill_delta = __toESM(require_Delta(), 1);

  // node_modules/quill/blots/break.js
  var Break = class extends EmbedBlot$1 {
    static value() {
      return void 0;
    }
    optimize() {
      if (this.prev || this.next) {
        this.remove();
      }
    }
    length() {
      return 0;
    }
    value() {
      return "";
    }
  };
  Break.blotName = "break";
  Break.tagName = "BR";
  var break_default = Break;

  // node_modules/quill/blots/text.js
  var Text2 = class extends TextBlot$1 {
  };
  function escapeText(text) {
    return text.replace(/[&<>"']/g, (s) => {
      const entityMap = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      return entityMap[s];
    });
  }

  // node_modules/quill/blots/inline.js
  var Inline = class _Inline extends InlineBlot$1 {
    static allowedChildren = [_Inline, break_default, EmbedBlot$1, Text2];
    // Lower index means deeper in the DOM tree, since not found (-1) is for embeds
    static order = [
      "cursor",
      "inline",
      // Must be lower
      "link",
      // Chrome wants <a> to be lower
      "underline",
      "strike",
      "italic",
      "bold",
      "script",
      "code"
      // Must be higher
    ];
    static compare(self2, other) {
      const selfIndex = _Inline.order.indexOf(self2);
      const otherIndex = _Inline.order.indexOf(other);
      if (selfIndex >= 0 || otherIndex >= 0) {
        return selfIndex - otherIndex;
      }
      if (self2 === other) {
        return 0;
      }
      if (self2 < other) {
        return -1;
      }
      return 1;
    }
    formatAt(index, length, name, value) {
      if (_Inline.compare(this.statics.blotName, name) < 0 && this.scroll.query(name, Scope.BLOT)) {
        const blot = this.isolate(index, length);
        if (value) {
          blot.wrap(name, value);
        }
      } else {
        super.formatAt(index, length, name, value);
      }
    }
    optimize(context) {
      super.optimize(context);
      if (this.parent instanceof _Inline && _Inline.compare(this.statics.blotName, this.parent.statics.blotName) > 0) {
        const parent = this.parent.isolate(this.offset(), this.length());
        this.moveChildren(parent);
        parent.wrap(this);
      }
    }
  };
  var inline_default = Inline;

  // node_modules/quill/blots/block.js
  var NEWLINE_LENGTH = 1;
  var Block = class extends BlockBlot$1 {
    cache = {};
    delta() {
      if (this.cache.delta == null) {
        this.cache.delta = blockDelta(this);
      }
      return this.cache.delta;
    }
    deleteAt(index, length) {
      super.deleteAt(index, length);
      this.cache = {};
    }
    formatAt(index, length, name, value) {
      if (length <= 0)
        return;
      if (this.scroll.query(name, Scope.BLOCK)) {
        if (index + length === this.length()) {
          this.format(name, value);
        }
      } else {
        super.formatAt(index, Math.min(length, this.length() - index - 1), name, value);
      }
      this.cache = {};
    }
    insertAt(index, value, def) {
      if (def != null) {
        super.insertAt(index, value, def);
        this.cache = {};
        return;
      }
      if (value.length === 0)
        return;
      const lines = value.split("\n");
      const text = lines.shift();
      if (text.length > 0) {
        if (index < this.length() - 1 || this.children.tail == null) {
          super.insertAt(Math.min(index, this.length() - 1), text);
        } else {
          this.children.tail.insertAt(this.children.tail.length(), text);
        }
        this.cache = {};
      }
      let block = this;
      lines.reduce((lineIndex, line) => {
        block = block.split(lineIndex, true);
        block.insertAt(0, line);
        return line.length;
      }, index + text.length);
    }
    insertBefore(blot, ref) {
      const {
        head
      } = this.children;
      super.insertBefore(blot, ref);
      if (head instanceof break_default) {
        head.remove();
      }
      this.cache = {};
    }
    length() {
      if (this.cache.length == null) {
        this.cache.length = super.length() + NEWLINE_LENGTH;
      }
      return this.cache.length;
    }
    moveChildren(target, ref) {
      super.moveChildren(target, ref);
      this.cache = {};
    }
    optimize(context) {
      super.optimize(context);
      this.cache = {};
    }
    path(index) {
      return super.path(index, true);
    }
    removeChild(child) {
      super.removeChild(child);
      this.cache = {};
    }
    split(index) {
      let force = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      if (force && (index === 0 || index >= this.length() - NEWLINE_LENGTH)) {
        const clone = this.clone();
        if (index === 0) {
          this.parent.insertBefore(clone, this);
          return this;
        }
        this.parent.insertBefore(clone, this.next);
        return clone;
      }
      const next = super.split(index, force);
      this.cache = {};
      return next;
    }
  };
  Block.blotName = "block";
  Block.tagName = "P";
  Block.defaultChild = break_default;
  Block.allowedChildren = [break_default, inline_default, EmbedBlot$1, Text2];
  var BlockEmbed = class extends EmbedBlot$1 {
    attach() {
      super.attach();
      this.attributes = new AttributorStore$1(this.domNode);
    }
    delta() {
      return new import_quill_delta.default().insert(this.value(), {
        ...this.formats(),
        ...this.attributes.values()
      });
    }
    format(name, value) {
      const attribute = this.scroll.query(name, Scope.BLOCK_ATTRIBUTE);
      if (attribute != null) {
        this.attributes.attribute(attribute, value);
      }
    }
    formatAt(index, length, name, value) {
      this.format(name, value);
    }
    insertAt(index, value, def) {
      if (def != null) {
        super.insertAt(index, value, def);
        return;
      }
      const lines = value.split("\n");
      const text = lines.pop();
      const blocks = lines.map((line) => {
        const block = this.scroll.create(Block.blotName);
        block.insertAt(0, line);
        return block;
      });
      const ref = this.split(index);
      blocks.forEach((block) => {
        this.parent.insertBefore(block, ref);
      });
      if (text) {
        this.parent.insertBefore(this.scroll.create("text", text), ref);
      }
    }
  };
  BlockEmbed.scope = Scope.BLOCK_BLOT;
  function blockDelta(blot) {
    let filter = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : true;
    return blot.descendants(LeafBlot$1).reduce((delta, leaf) => {
      if (leaf.length() === 0) {
        return delta;
      }
      return delta.insert(leaf.value(), bubbleFormats(leaf, {}, filter));
    }, new import_quill_delta.default()).insert("\n", bubbleFormats(blot));
  }
  function bubbleFormats(blot) {
    let formats = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let filter = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : true;
    if (blot == null)
      return formats;
    if ("formats" in blot && typeof blot.formats === "function") {
      formats = {
        ...formats,
        ...blot.formats()
      };
      if (filter) {
        delete formats["code-token"];
      }
    }
    if (blot.parent == null || blot.parent.statics.blotName === "scroll" || blot.parent.statics.scope !== blot.statics.scope) {
      return formats;
    }
    return bubbleFormats(blot.parent, formats, filter);
  }

  // node_modules/quill/blots/cursor.js
  var Cursor = class _Cursor extends EmbedBlot$1 {
    static blotName = "cursor";
    static className = "ql-cursor";
    static tagName = "span";
    static CONTENTS = "\uFEFF";
    // Zero width no break space
    static value() {
      return void 0;
    }
    constructor(scroll, domNode, selection) {
      super(scroll, domNode);
      this.selection = selection;
      this.textNode = document.createTextNode(_Cursor.CONTENTS);
      this.domNode.appendChild(this.textNode);
      this.savedLength = 0;
    }
    detach() {
      if (this.parent != null)
        this.parent.removeChild(this);
    }
    format(name, value) {
      if (this.savedLength !== 0) {
        super.format(name, value);
        return;
      }
      let target = this;
      let index = 0;
      while (target != null && target.statics.scope !== Scope.BLOCK_BLOT) {
        index += target.offset(target.parent);
        target = target.parent;
      }
      if (target != null) {
        this.savedLength = _Cursor.CONTENTS.length;
        target.optimize();
        target.formatAt(index, _Cursor.CONTENTS.length, name, value);
        this.savedLength = 0;
      }
    }
    index(node, offset) {
      if (node === this.textNode)
        return 0;
      return super.index(node, offset);
    }
    length() {
      return this.savedLength;
    }
    position() {
      return [this.textNode, this.textNode.data.length];
    }
    remove() {
      super.remove();
      this.parent = null;
    }
    restore() {
      if (this.selection.composing || this.parent == null)
        return null;
      const range = this.selection.getNativeRange();
      while (this.domNode.lastChild != null && this.domNode.lastChild !== this.textNode) {
        this.domNode.parentNode.insertBefore(this.domNode.lastChild, this.domNode);
      }
      const prevTextBlot = this.prev instanceof Text2 ? this.prev : null;
      const prevTextLength = prevTextBlot ? prevTextBlot.length() : 0;
      const nextTextBlot = this.next instanceof Text2 ? this.next : null;
      const nextText = nextTextBlot ? nextTextBlot.text : "";
      const {
        textNode
      } = this;
      const newText = textNode.data.split(_Cursor.CONTENTS).join("");
      textNode.data = _Cursor.CONTENTS;
      let mergedTextBlot;
      if (prevTextBlot) {
        mergedTextBlot = prevTextBlot;
        if (newText || nextTextBlot) {
          prevTextBlot.insertAt(prevTextBlot.length(), newText + nextText);
          if (nextTextBlot) {
            nextTextBlot.remove();
          }
        }
      } else if (nextTextBlot) {
        mergedTextBlot = nextTextBlot;
        nextTextBlot.insertAt(0, newText);
      } else {
        const newTextNode = document.createTextNode(newText);
        mergedTextBlot = this.scroll.create(newTextNode);
        this.parent.insertBefore(mergedTextBlot, this);
      }
      this.remove();
      if (range) {
        const remapOffset = (node, offset) => {
          if (prevTextBlot && node === prevTextBlot.domNode) {
            return offset;
          }
          if (node === textNode) {
            return prevTextLength + offset - 1;
          }
          if (nextTextBlot && node === nextTextBlot.domNode) {
            return prevTextLength + newText.length + offset;
          }
          return null;
        };
        const start = remapOffset(range.start.node, range.start.offset);
        const end = remapOffset(range.end.node, range.end.offset);
        if (start !== null && end !== null) {
          return {
            startNode: mergedTextBlot.domNode,
            startOffset: start,
            endNode: mergedTextBlot.domNode,
            endOffset: end
          };
        }
      }
      return null;
    }
    update(mutations, context) {
      if (mutations.some((mutation) => {
        return mutation.type === "characterData" && mutation.target === this.textNode;
      })) {
        const range = this.restore();
        if (range)
          context.range = range;
      }
    }
    // Avoid .ql-cursor being a descendant of `<a/>`.
    // The reason is Safari pushes down `<a/>` on text insertion.
    // That will cause DOM nodes not sync with the model.
    //
    // For example ({I} is the caret), given the markup:
    //    <a><span class="ql-cursor">\uFEFF{I}</span></a>
    // When typing a char "x", `<a/>` will be pushed down inside the `<span>` first:
    //    <span class="ql-cursor"><a>\uFEFF{I}</a></span>
    // And then "x" will be inserted after `<a/>`:
    //    <span class="ql-cursor"><a>\uFEFF</a>d{I}</span>
    optimize(context) {
      super.optimize(context);
      let {
        parent
      } = this;
      while (parent) {
        if (parent.domNode.tagName === "A") {
          this.savedLength = _Cursor.CONTENTS.length;
          parent.isolate(this.offset(parent), this.length()).unwrap();
          this.savedLength = 0;
          break;
        }
        parent = parent.parent;
      }
    }
    value() {
      return "";
    }
  };
  var cursor_default = Cursor;

  // node_modules/eventemitter3/index.mjs
  var import_index = __toESM(require_eventemitter3(), 1);

  // node_modules/quill/core/instances.js
  var instances_default = /* @__PURE__ */ new WeakMap();

  // node_modules/quill/core/logger.js
  var levels = ["error", "warn", "log", "info"];
  var level = "warn";
  function debug2(method) {
    if (level) {
      if (levels.indexOf(method) <= levels.indexOf(level)) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        console[method](...args);
      }
    }
  }
  function namespace(ns) {
    return levels.reduce((logger, method) => {
      logger[method] = debug2.bind(console, method, ns);
      return logger;
    }, {});
  }
  namespace.level = (newLevel) => {
    level = newLevel;
  };
  debug2.level = namespace.level;
  var logger_default = namespace;

  // node_modules/quill/core/emitter.js
  var debug3 = logger_default("quill:events");
  var EVENTS = ["selectionchange", "mousedown", "mouseup", "click"];
  EVENTS.forEach((eventName) => {
    document.addEventListener(eventName, function() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      Array.from(document.querySelectorAll(".ql-container")).forEach((node) => {
        const quill = instances_default.get(node);
        if (quill && quill.emitter) {
          quill.emitter.handleDOM(...args);
        }
      });
    });
  });
  var Emitter = class extends import_index.default {
    static events = {
      EDITOR_CHANGE: "editor-change",
      SCROLL_BEFORE_UPDATE: "scroll-before-update",
      SCROLL_BLOT_MOUNT: "scroll-blot-mount",
      SCROLL_BLOT_UNMOUNT: "scroll-blot-unmount",
      SCROLL_OPTIMIZE: "scroll-optimize",
      SCROLL_UPDATE: "scroll-update",
      SCROLL_EMBED_UPDATE: "scroll-embed-update",
      SELECTION_CHANGE: "selection-change",
      TEXT_CHANGE: "text-change",
      COMPOSITION_BEFORE_START: "composition-before-start",
      COMPOSITION_START: "composition-start",
      COMPOSITION_BEFORE_END: "composition-before-end",
      COMPOSITION_END: "composition-end"
    };
    static sources = {
      API: "api",
      SILENT: "silent",
      USER: "user"
    };
    constructor() {
      super();
      this.domListeners = {};
      this.on("error", debug3.error);
    }
    emit() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }
      debug3.log.call(debug3, ...args);
      return super.emit(...args);
    }
    handleDOM(event) {
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      (this.domListeners[event.type] || []).forEach((_ref) => {
        let {
          node,
          handler
        } = _ref;
        if (event.target === node || node.contains(event.target)) {
          handler(event, ...args);
        }
      });
    }
    listenDOM(eventName, node, handler) {
      if (!this.domListeners[eventName]) {
        this.domListeners[eventName] = [];
      }
      this.domListeners[eventName].push({
        node,
        handler
      });
    }
  };
  var emitter_default = Emitter;

  // node_modules/quill/core/selection.js
  var debug4 = logger_default("quill:selection");
  var Range = class {
    constructor(index) {
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      this.index = index;
      this.length = length;
    }
  };
  var Selection = class {
    constructor(scroll, emitter) {
      this.emitter = emitter;
      this.scroll = scroll;
      this.composing = false;
      this.mouseDown = false;
      this.root = this.scroll.domNode;
      this.cursor = this.scroll.create("cursor", this);
      this.savedRange = new Range(0, 0);
      this.lastRange = this.savedRange;
      this.lastNative = null;
      this.handleComposition();
      this.handleDragging();
      this.emitter.listenDOM("selectionchange", document, () => {
        if (!this.mouseDown && !this.composing) {
          setTimeout(this.update.bind(this, emitter_default.sources.USER), 1);
        }
      });
      this.emitter.on(emitter_default.events.SCROLL_BEFORE_UPDATE, () => {
        if (!this.hasFocus())
          return;
        const native = this.getNativeRange();
        if (native == null)
          return;
        if (native.start.node === this.cursor.textNode)
          return;
        this.emitter.once(emitter_default.events.SCROLL_UPDATE, (source, mutations) => {
          try {
            if (this.root.contains(native.start.node) && this.root.contains(native.end.node)) {
              this.setNativeRange(native.start.node, native.start.offset, native.end.node, native.end.offset);
            }
            const triggeredByTyping = mutations.some((mutation) => mutation.type === "characterData" || mutation.type === "childList" || mutation.type === "attributes" && mutation.target === this.root);
            this.update(triggeredByTyping ? emitter_default.sources.SILENT : source);
          } catch (ignored) {
          }
        });
      });
      this.emitter.on(emitter_default.events.SCROLL_OPTIMIZE, (mutations, context) => {
        if (context.range) {
          const {
            startNode,
            startOffset,
            endNode,
            endOffset
          } = context.range;
          this.setNativeRange(startNode, startOffset, endNode, endOffset);
          this.update(emitter_default.sources.SILENT);
        }
      });
      this.update(emitter_default.sources.SILENT);
    }
    handleComposition() {
      this.emitter.on(emitter_default.events.COMPOSITION_BEFORE_START, () => {
        this.composing = true;
      });
      this.emitter.on(emitter_default.events.COMPOSITION_END, () => {
        this.composing = false;
        if (this.cursor.parent) {
          const range = this.cursor.restore();
          if (!range)
            return;
          setTimeout(() => {
            this.setNativeRange(range.startNode, range.startOffset, range.endNode, range.endOffset);
          }, 1);
        }
      });
    }
    handleDragging() {
      this.emitter.listenDOM("mousedown", document.body, () => {
        this.mouseDown = true;
      });
      this.emitter.listenDOM("mouseup", document.body, () => {
        this.mouseDown = false;
        this.update(emitter_default.sources.USER);
      });
    }
    focus() {
      if (this.hasFocus())
        return;
      this.root.focus({
        preventScroll: true
      });
      this.setRange(this.savedRange);
    }
    format(format, value) {
      this.scroll.update();
      const nativeRange = this.getNativeRange();
      if (nativeRange == null || !nativeRange.native.collapsed || this.scroll.query(format, Scope.BLOCK))
        return;
      if (nativeRange.start.node !== this.cursor.textNode) {
        const blot = this.scroll.find(nativeRange.start.node, false);
        if (blot == null)
          return;
        if (blot instanceof LeafBlot$1) {
          const after = blot.split(nativeRange.start.offset);
          blot.parent.insertBefore(this.cursor, after);
        } else {
          blot.insertBefore(this.cursor, nativeRange.start.node);
        }
        this.cursor.attach();
      }
      this.cursor.format(format, value);
      this.scroll.optimize();
      this.setNativeRange(this.cursor.textNode, this.cursor.textNode.data.length);
      this.update();
    }
    getBounds(index) {
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      const scrollLength = this.scroll.length();
      index = Math.min(index, scrollLength - 1);
      length = Math.min(index + length, scrollLength - 1) - index;
      let node;
      let [leaf, offset] = this.scroll.leaf(index);
      if (leaf == null)
        return null;
      if (length > 0 && offset === leaf.length()) {
        const [next] = this.scroll.leaf(index + 1);
        if (next) {
          const [line] = this.scroll.line(index);
          const [nextLine] = this.scroll.line(index + 1);
          if (line === nextLine) {
            leaf = next;
            offset = 0;
          }
        }
      }
      [node, offset] = leaf.position(offset, true);
      const range = document.createRange();
      if (length > 0) {
        range.setStart(node, offset);
        [leaf, offset] = this.scroll.leaf(index + length);
        if (leaf == null)
          return null;
        [node, offset] = leaf.position(offset, true);
        range.setEnd(node, offset);
        return range.getBoundingClientRect();
      }
      let side = "left";
      let rect;
      if (node instanceof Text) {
        if (!node.data.length) {
          return null;
        }
        if (offset < node.data.length) {
          range.setStart(node, offset);
          range.setEnd(node, offset + 1);
        } else {
          range.setStart(node, offset - 1);
          range.setEnd(node, offset);
          side = "right";
        }
        rect = range.getBoundingClientRect();
      } else {
        if (!(leaf.domNode instanceof Element))
          return null;
        rect = leaf.domNode.getBoundingClientRect();
        if (offset > 0)
          side = "right";
      }
      return {
        bottom: rect.top + rect.height,
        height: rect.height,
        left: rect[side],
        right: rect[side],
        top: rect.top,
        width: 0
      };
    }
    getNativeRange() {
      const selection = document.getSelection();
      if (selection == null || selection.rangeCount <= 0)
        return null;
      const nativeRange = selection.getRangeAt(0);
      if (nativeRange == null)
        return null;
      const range = this.normalizeNative(nativeRange);
      debug4.info("getNativeRange", range);
      return range;
    }
    getRange() {
      const root2 = this.scroll.domNode;
      if ("isConnected" in root2 && !root2.isConnected) {
        return [null, null];
      }
      const normalized = this.getNativeRange();
      if (normalized == null)
        return [null, null];
      const range = this.normalizedToRange(normalized);
      return [range, normalized];
    }
    hasFocus() {
      return document.activeElement === this.root || document.activeElement != null && contains(this.root, document.activeElement);
    }
    normalizedToRange(range) {
      const positions = [[range.start.node, range.start.offset]];
      if (!range.native.collapsed) {
        positions.push([range.end.node, range.end.offset]);
      }
      const indexes = positions.map((position) => {
        const [node, offset] = position;
        const blot = this.scroll.find(node, true);
        const index = blot.offset(this.scroll);
        if (offset === 0) {
          return index;
        }
        if (blot instanceof LeafBlot$1) {
          return index + blot.index(node, offset);
        }
        return index + blot.length();
      });
      const end = Math.min(Math.max(...indexes), this.scroll.length() - 1);
      const start = Math.min(end, ...indexes);
      return new Range(start, end - start);
    }
    normalizeNative(nativeRange) {
      if (!contains(this.root, nativeRange.startContainer) || !nativeRange.collapsed && !contains(this.root, nativeRange.endContainer)) {
        return null;
      }
      const range = {
        start: {
          node: nativeRange.startContainer,
          offset: nativeRange.startOffset
        },
        end: {
          node: nativeRange.endContainer,
          offset: nativeRange.endOffset
        },
        native: nativeRange
      };
      [range.start, range.end].forEach((position) => {
        let {
          node,
          offset
        } = position;
        while (!(node instanceof Text) && node.childNodes.length > 0) {
          if (node.childNodes.length > offset) {
            node = node.childNodes[offset];
            offset = 0;
          } else if (node.childNodes.length === offset) {
            node = node.lastChild;
            if (node instanceof Text) {
              offset = node.data.length;
            } else if (node.childNodes.length > 0) {
              offset = node.childNodes.length;
            } else {
              offset = node.childNodes.length + 1;
            }
          } else {
            break;
          }
        }
        position.node = node;
        position.offset = offset;
      });
      return range;
    }
    rangeToNative(range) {
      const scrollLength = this.scroll.length();
      const getPosition = (index, inclusive) => {
        index = Math.min(scrollLength - 1, index);
        const [leaf, leafOffset] = this.scroll.leaf(index);
        return leaf ? leaf.position(leafOffset, inclusive) : [null, -1];
      };
      return [...getPosition(range.index, false), ...getPosition(range.index + range.length, true)];
    }
    setNativeRange(startNode, startOffset) {
      let endNode = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : startNode;
      let endOffset = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : startOffset;
      let force = arguments.length > 4 && arguments[4] !== void 0 ? arguments[4] : false;
      debug4.info("setNativeRange", startNode, startOffset, endNode, endOffset);
      if (startNode != null && (this.root.parentNode == null || startNode.parentNode == null || // @ts-expect-error Fix me later
      endNode.parentNode == null)) {
        return;
      }
      const selection = document.getSelection();
      if (selection == null)
        return;
      if (startNode != null) {
        if (!this.hasFocus())
          this.root.focus({
            preventScroll: true
          });
        const {
          native
        } = this.getNativeRange() || {};
        if (native == null || force || startNode !== native.startContainer || startOffset !== native.startOffset || endNode !== native.endContainer || endOffset !== native.endOffset) {
          if (startNode instanceof Element && startNode.tagName === "BR") {
            startOffset = Array.from(startNode.parentNode.childNodes).indexOf(startNode);
            startNode = startNode.parentNode;
          }
          if (endNode instanceof Element && endNode.tagName === "BR") {
            endOffset = Array.from(endNode.parentNode.childNodes).indexOf(endNode);
            endNode = endNode.parentNode;
          }
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } else {
        selection.removeAllRanges();
        this.root.blur();
      }
    }
    setRange(range) {
      let force = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      let source = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : emitter_default.sources.API;
      if (typeof force === "string") {
        source = force;
        force = false;
      }
      debug4.info("setRange", range);
      if (range != null) {
        const args = this.rangeToNative(range);
        this.setNativeRange(...args, force);
      } else {
        this.setNativeRange(null);
      }
      this.update(source);
    }
    update() {
      let source = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : emitter_default.sources.USER;
      const oldRange = this.lastRange;
      const [lastRange, nativeRange] = this.getRange();
      this.lastRange = lastRange;
      this.lastNative = nativeRange;
      if (this.lastRange != null) {
        this.savedRange = this.lastRange;
      }
      if (!isEqual_default(oldRange, this.lastRange)) {
        if (!this.composing && nativeRange != null && nativeRange.native.collapsed && nativeRange.start.node !== this.cursor.textNode) {
          const range = this.cursor.restore();
          if (range) {
            this.setNativeRange(range.startNode, range.startOffset, range.endNode, range.endOffset);
          }
        }
        const args = [emitter_default.events.SELECTION_CHANGE, cloneDeep_default(this.lastRange), cloneDeep_default(oldRange), source];
        this.emitter.emit(emitter_default.events.EDITOR_CHANGE, ...args);
        if (source !== emitter_default.sources.SILENT) {
          this.emitter.emit(...args);
        }
      }
    }
  };
  function contains(parent, descendant) {
    try {
      descendant.parentNode;
    } catch (e) {
      return false;
    }
    return parent.contains(descendant);
  }
  var selection_default = Selection;

  // node_modules/quill/core/editor.js
  var ASCII = /^[ -~]*$/;
  var Editor = class {
    constructor(scroll) {
      this.scroll = scroll;
      this.delta = this.getDelta();
    }
    applyDelta(delta) {
      this.scroll.update();
      let scrollLength = this.scroll.length();
      this.scroll.batchStart();
      const normalizedDelta = normalizeDelta(delta);
      const deleteDelta = new import_quill_delta2.default();
      const normalizedOps = splitOpLines(normalizedDelta.ops.slice());
      normalizedOps.reduce((index, op) => {
        const length = import_quill_delta2.Op.length(op);
        let attributes = op.attributes || {};
        let isImplicitNewlinePrepended = false;
        let isImplicitNewlineAppended = false;
        if (op.insert != null) {
          deleteDelta.retain(length);
          if (typeof op.insert === "string") {
            const text = op.insert;
            isImplicitNewlineAppended = !text.endsWith("\n") && (scrollLength <= index || !!this.scroll.descendant(BlockEmbed, index)[0]);
            this.scroll.insertAt(index, text);
            const [line, offset] = this.scroll.line(index);
            let formats = merge_default({}, bubbleFormats(line));
            if (line instanceof Block) {
              const [leaf] = line.descendant(LeafBlot$1, offset);
              if (leaf) {
                formats = merge_default(formats, bubbleFormats(leaf));
              }
            }
            attributes = import_quill_delta2.AttributeMap.diff(formats, attributes) || {};
          } else if (typeof op.insert === "object") {
            const key = Object.keys(op.insert)[0];
            if (key == null)
              return index;
            const isInlineEmbed = this.scroll.query(key, Scope.INLINE) != null;
            if (isInlineEmbed) {
              if (scrollLength <= index || !!this.scroll.descendant(BlockEmbed, index)[0]) {
                isImplicitNewlineAppended = true;
              }
            } else if (index > 0) {
              const [leaf, offset] = this.scroll.descendant(LeafBlot$1, index - 1);
              if (leaf instanceof Text2) {
                const text = leaf.value();
                if (text[offset] !== "\n") {
                  isImplicitNewlinePrepended = true;
                }
              } else if (leaf instanceof EmbedBlot$1 && leaf.statics.scope === Scope.INLINE_BLOT) {
                isImplicitNewlinePrepended = true;
              }
            }
            this.scroll.insertAt(index, key, op.insert[key]);
            if (isInlineEmbed) {
              const [leaf] = this.scroll.descendant(LeafBlot$1, index);
              if (leaf) {
                const formats = merge_default({}, bubbleFormats(leaf));
                attributes = import_quill_delta2.AttributeMap.diff(formats, attributes) || {};
              }
            }
          }
          scrollLength += length;
        } else {
          deleteDelta.push(op);
          if (op.retain !== null && typeof op.retain === "object") {
            const key = Object.keys(op.retain)[0];
            if (key == null)
              return index;
            this.scroll.updateEmbedAt(index, key, op.retain[key]);
          }
        }
        Object.keys(attributes).forEach((name) => {
          this.scroll.formatAt(index, length, name, attributes[name]);
        });
        const prependedLength = isImplicitNewlinePrepended ? 1 : 0;
        const addedLength = isImplicitNewlineAppended ? 1 : 0;
        scrollLength += prependedLength + addedLength;
        deleteDelta.retain(prependedLength);
        deleteDelta.delete(addedLength);
        return index + length + prependedLength + addedLength;
      }, 0);
      deleteDelta.reduce((index, op) => {
        if (typeof op.delete === "number") {
          this.scroll.deleteAt(index, op.delete);
          return index;
        }
        return index + import_quill_delta2.Op.length(op);
      }, 0);
      this.scroll.batchEnd();
      this.scroll.optimize();
      return this.update(normalizedDelta);
    }
    deleteText(index, length) {
      this.scroll.deleteAt(index, length);
      return this.update(new import_quill_delta2.default().retain(index).delete(length));
    }
    formatLine(index, length) {
      let formats = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      this.scroll.update();
      Object.keys(formats).forEach((format) => {
        this.scroll.lines(index, Math.max(length, 1)).forEach((line) => {
          line.format(format, formats[format]);
        });
      });
      this.scroll.optimize();
      const delta = new import_quill_delta2.default().retain(index).retain(length, cloneDeep_default(formats));
      return this.update(delta);
    }
    formatText(index, length) {
      let formats = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      Object.keys(formats).forEach((format) => {
        this.scroll.formatAt(index, length, format, formats[format]);
      });
      const delta = new import_quill_delta2.default().retain(index).retain(length, cloneDeep_default(formats));
      return this.update(delta);
    }
    getContents(index, length) {
      return this.delta.slice(index, index + length);
    }
    getDelta() {
      return this.scroll.lines().reduce((delta, line) => {
        return delta.concat(line.delta());
      }, new import_quill_delta2.default());
    }
    getFormat(index) {
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      let lines = [];
      let leaves = [];
      if (length === 0) {
        this.scroll.path(index).forEach((path) => {
          const [blot] = path;
          if (blot instanceof Block) {
            lines.push(blot);
          } else if (blot instanceof LeafBlot$1) {
            leaves.push(blot);
          }
        });
      } else {
        lines = this.scroll.lines(index, length);
        leaves = this.scroll.descendants(LeafBlot$1, index, length);
      }
      const [lineFormats, leafFormats] = [lines, leaves].map((blots) => {
        const blot = blots.shift();
        if (blot == null)
          return {};
        let formats = bubbleFormats(blot);
        while (Object.keys(formats).length > 0) {
          const blot2 = blots.shift();
          if (blot2 == null)
            return formats;
          formats = combineFormats(bubbleFormats(blot2), formats);
        }
        return formats;
      });
      return {
        ...lineFormats,
        ...leafFormats
      };
    }
    getHTML(index, length) {
      const [line, lineOffset] = this.scroll.line(index);
      if (line) {
        const lineLength = line.length();
        const isWithinLine = line.length() >= lineOffset + length;
        if (isWithinLine && !(lineOffset === 0 && length === lineLength)) {
          return convertHTML(line, lineOffset, length, true);
        }
        return convertHTML(this.scroll, index, length, true);
      }
      return "";
    }
    getText(index, length) {
      return this.getContents(index, length).filter((op) => typeof op.insert === "string").map((op) => op.insert).join("");
    }
    insertContents(index, contents) {
      const normalizedDelta = normalizeDelta(contents);
      const change = new import_quill_delta2.default().retain(index).concat(normalizedDelta);
      this.scroll.insertContents(index, normalizedDelta);
      return this.update(change);
    }
    insertEmbed(index, embed, value) {
      this.scroll.insertAt(index, embed, value);
      return this.update(new import_quill_delta2.default().retain(index).insert({
        [embed]: value
      }));
    }
    insertText(index, text) {
      let formats = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      this.scroll.insertAt(index, text);
      Object.keys(formats).forEach((format) => {
        this.scroll.formatAt(index, text.length, format, formats[format]);
      });
      return this.update(new import_quill_delta2.default().retain(index).insert(text, cloneDeep_default(formats)));
    }
    isBlank() {
      if (this.scroll.children.length === 0)
        return true;
      if (this.scroll.children.length > 1)
        return false;
      const blot = this.scroll.children.head;
      if (blot?.statics.blotName !== Block.blotName)
        return false;
      const block = blot;
      if (block.children.length > 1)
        return false;
      return block.children.head instanceof break_default;
    }
    removeFormat(index, length) {
      const text = this.getText(index, length);
      const [line, offset] = this.scroll.line(index + length);
      let suffixLength = 0;
      let suffix = new import_quill_delta2.default();
      if (line != null) {
        suffixLength = line.length() - offset;
        suffix = line.delta().slice(offset, offset + suffixLength - 1).insert("\n");
      }
      const contents = this.getContents(index, length + suffixLength);
      const diff = contents.diff(new import_quill_delta2.default().insert(text).concat(suffix));
      const delta = new import_quill_delta2.default().retain(index).concat(diff);
      return this.applyDelta(delta);
    }
    update(change) {
      let mutations = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : [];
      let selectionInfo = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : void 0;
      const oldDelta = this.delta;
      if (mutations.length === 1 && mutations[0].type === "characterData" && // @ts-expect-error Fix me later
      mutations[0].target.data.match(ASCII) && this.scroll.find(mutations[0].target)) {
        const textBlot = this.scroll.find(mutations[0].target);
        const formats = bubbleFormats(textBlot);
        const index = textBlot.offset(this.scroll);
        const oldValue = mutations[0].oldValue.replace(cursor_default.CONTENTS, "");
        const oldText = new import_quill_delta2.default().insert(oldValue);
        const newText = new import_quill_delta2.default().insert(textBlot.value());
        const relativeSelectionInfo = selectionInfo && {
          oldRange: shiftRange(selectionInfo.oldRange, -index),
          newRange: shiftRange(selectionInfo.newRange, -index)
        };
        const diffDelta = new import_quill_delta2.default().retain(index).concat(oldText.diff(newText, relativeSelectionInfo));
        change = diffDelta.reduce((delta, op) => {
          if (op.insert) {
            return delta.insert(op.insert, formats);
          }
          return delta.push(op);
        }, new import_quill_delta2.default());
        this.delta = oldDelta.compose(change);
      } else {
        this.delta = this.getDelta();
        if (!change || !isEqual_default(oldDelta.compose(change), this.delta)) {
          change = oldDelta.diff(this.delta, selectionInfo);
        }
      }
      return change;
    }
  };
  function convertListHTML(items, lastIndent, types) {
    if (items.length === 0) {
      const [endTag2] = getListType(types.pop());
      if (lastIndent <= 0) {
        return `</li></${endTag2}>`;
      }
      return `</li></${endTag2}>${convertListHTML([], lastIndent - 1, types)}`;
    }
    const [{
      child,
      offset,
      length,
      indent,
      type
    }, ...rest] = items;
    const [tag, attribute] = getListType(type);
    if (indent > lastIndent) {
      types.push(type);
      if (indent === lastIndent + 1) {
        return `<${tag}><li${attribute}>${convertHTML(child, offset, length)}${convertListHTML(rest, indent, types)}`;
      }
      return `<${tag}><li>${convertListHTML(items, lastIndent + 1, types)}`;
    }
    const previousType = types[types.length - 1];
    if (indent === lastIndent && type === previousType) {
      return `</li><li${attribute}>${convertHTML(child, offset, length)}${convertListHTML(rest, indent, types)}`;
    }
    const [endTag] = getListType(types.pop());
    return `</li></${endTag}>${convertListHTML(items, lastIndent - 1, types)}`;
  }
  function convertHTML(blot, index, length) {
    let isRoot = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : false;
    if ("html" in blot && typeof blot.html === "function") {
      return blot.html(index, length);
    }
    if (blot instanceof Text2) {
      return escapeText(blot.value().slice(index, index + length));
    }
    if (blot instanceof ParentBlot$1) {
      if (blot.statics.blotName === "list-container") {
        const items = [];
        blot.children.forEachAt(index, length, (child, offset, childLength) => {
          const formats = "formats" in child && typeof child.formats === "function" ? child.formats() : {};
          items.push({
            child,
            offset,
            length: childLength,
            indent: formats.indent || 0,
            type: formats.list
          });
        });
        return convertListHTML(items, -1, []);
      }
      const parts = [];
      blot.children.forEachAt(index, length, (child, offset, childLength) => {
        parts.push(convertHTML(child, offset, childLength));
      });
      if (isRoot || blot.statics.blotName === "list") {
        return parts.join("");
      }
      const {
        outerHTML,
        innerHTML
      } = blot.domNode;
      const [start, end] = outerHTML.split(`>${innerHTML}<`);
      if (start === "<table") {
        return `<table style="border: 1px solid #000;">${parts.join("")}<${end}`;
      }
      return `${start}>${parts.join("")}<${end}`;
    }
    return blot.domNode instanceof Element ? blot.domNode.outerHTML : "";
  }
  function combineFormats(formats, combined) {
    return Object.keys(combined).reduce((merged, name) => {
      if (formats[name] == null)
        return merged;
      const combinedValue = combined[name];
      if (combinedValue === formats[name]) {
        merged[name] = combinedValue;
      } else if (Array.isArray(combinedValue)) {
        if (combinedValue.indexOf(formats[name]) < 0) {
          merged[name] = combinedValue.concat([formats[name]]);
        } else {
          merged[name] = combinedValue;
        }
      } else {
        merged[name] = [combinedValue, formats[name]];
      }
      return merged;
    }, {});
  }
  function getListType(type) {
    const tag = type === "ordered" ? "ol" : "ul";
    switch (type) {
      case "checked":
        return [tag, ' data-list="checked"'];
      case "unchecked":
        return [tag, ' data-list="unchecked"'];
      default:
        return [tag, ""];
    }
  }
  function normalizeDelta(delta) {
    return delta.reduce((normalizedDelta, op) => {
      if (typeof op.insert === "string") {
        const text = op.insert.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        return normalizedDelta.insert(text, op.attributes);
      }
      return normalizedDelta.push(op);
    }, new import_quill_delta2.default());
  }
  function shiftRange(_ref, amount) {
    let {
      index,
      length
    } = _ref;
    return new Range(index + amount, length);
  }
  function splitOpLines(ops) {
    const split = [];
    ops.forEach((op) => {
      if (typeof op.insert === "string") {
        const lines = op.insert.split("\n");
        lines.forEach((line, index) => {
          if (index)
            split.push({
              insert: "\n",
              attributes: op.attributes
            });
          if (line)
            split.push({
              insert: line,
              attributes: op.attributes
            });
        });
      } else {
        split.push(op);
      }
    });
    return split;
  }
  var editor_default = Editor;

  // node_modules/quill/core/module.js
  var Module = class {
    static DEFAULTS = {};
    constructor(quill) {
      let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      this.quill = quill;
      this.options = options;
    }
  };
  var module_default = Module;

  // node_modules/quill/blots/embed.js
  var GUARD_TEXT = "\uFEFF";
  var Embed = class extends EmbedBlot$1 {
    constructor(scroll, node) {
      super(scroll, node);
      this.contentNode = document.createElement("span");
      this.contentNode.setAttribute("contenteditable", "false");
      Array.from(this.domNode.childNodes).forEach((childNode) => {
        this.contentNode.appendChild(childNode);
      });
      this.leftGuard = document.createTextNode(GUARD_TEXT);
      this.rightGuard = document.createTextNode(GUARD_TEXT);
      this.domNode.appendChild(this.leftGuard);
      this.domNode.appendChild(this.contentNode);
      this.domNode.appendChild(this.rightGuard);
    }
    index(node, offset) {
      if (node === this.leftGuard)
        return 0;
      if (node === this.rightGuard)
        return 1;
      return super.index(node, offset);
    }
    restore(node) {
      let range = null;
      let textNode;
      const text = node.data.split(GUARD_TEXT).join("");
      if (node === this.leftGuard) {
        if (this.prev instanceof Text2) {
          const prevLength = this.prev.length();
          this.prev.insertAt(prevLength, text);
          range = {
            startNode: this.prev.domNode,
            startOffset: prevLength + text.length
          };
        } else {
          textNode = document.createTextNode(text);
          this.parent.insertBefore(this.scroll.create(textNode), this);
          range = {
            startNode: textNode,
            startOffset: text.length
          };
        }
      } else if (node === this.rightGuard) {
        if (this.next instanceof Text2) {
          this.next.insertAt(0, text);
          range = {
            startNode: this.next.domNode,
            startOffset: text.length
          };
        } else {
          textNode = document.createTextNode(text);
          this.parent.insertBefore(this.scroll.create(textNode), this.next);
          range = {
            startNode: textNode,
            startOffset: text.length
          };
        }
      }
      node.data = GUARD_TEXT;
      return range;
    }
    update(mutations, context) {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData" && (mutation.target === this.leftGuard || mutation.target === this.rightGuard)) {
          const range = this.restore(mutation.target);
          if (range)
            context.range = range;
        }
      });
    }
  };
  var embed_default = Embed;

  // node_modules/quill/core/composition.js
  var Composition = class {
    isComposing = false;
    constructor(scroll, emitter) {
      this.scroll = scroll;
      this.emitter = emitter;
      this.setupListeners();
    }
    setupListeners() {
      this.scroll.domNode.addEventListener("compositionstart", (event) => {
        if (!this.isComposing) {
          this.handleCompositionStart(event);
        }
      });
      this.scroll.domNode.addEventListener("compositionend", (event) => {
        if (this.isComposing) {
          queueMicrotask(() => {
            this.handleCompositionEnd(event);
          });
        }
      });
    }
    handleCompositionStart(event) {
      const blot = event.target instanceof Node ? this.scroll.find(event.target, true) : null;
      if (blot && !(blot instanceof embed_default)) {
        this.emitter.emit(emitter_default.events.COMPOSITION_BEFORE_START, event);
        this.scroll.batchStart();
        this.emitter.emit(emitter_default.events.COMPOSITION_START, event);
        this.isComposing = true;
      }
    }
    handleCompositionEnd(event) {
      this.emitter.emit(emitter_default.events.COMPOSITION_BEFORE_END, event);
      this.scroll.batchEnd();
      this.emitter.emit(emitter_default.events.COMPOSITION_END, event);
      this.isComposing = false;
    }
  };
  var composition_default = Composition;

  // node_modules/quill/core/theme.js
  var Theme = class _Theme {
    static DEFAULTS = {
      modules: {}
    };
    static themes = {
      default: _Theme
    };
    modules = {};
    constructor(quill, options) {
      this.quill = quill;
      this.options = options;
    }
    init() {
      Object.keys(this.options.modules).forEach((name) => {
        if (this.modules[name] == null) {
          this.addModule(name);
        }
      });
    }
    addModule(name) {
      const ModuleClass = this.quill.constructor.import(`modules/${name}`);
      this.modules[name] = new ModuleClass(this.quill, this.options.modules[name] || {});
      return this.modules[name];
    }
  };
  var theme_default = Theme;

  // node_modules/quill/core/utils/scrollRectIntoView.js
  var getParentElement = (element) => element.parentElement || element.getRootNode().host || null;
  var getElementRect = (element) => {
    const rect = element.getBoundingClientRect();
    const scaleX = "offsetWidth" in element && Math.abs(rect.width) / element.offsetWidth || 1;
    const scaleY = "offsetHeight" in element && Math.abs(rect.height) / element.offsetHeight || 1;
    return {
      top: rect.top,
      right: rect.left + element.clientWidth * scaleX,
      bottom: rect.top + element.clientHeight * scaleY,
      left: rect.left
    };
  };
  var paddingValueToInt = (value) => {
    const number = parseInt(value, 10);
    return Number.isNaN(number) ? 0 : number;
  };
  var getScrollDistance = (targetStart, targetEnd, scrollStart, scrollEnd, scrollPaddingStart, scrollPaddingEnd) => {
    if (targetStart < scrollStart && targetEnd > scrollEnd) {
      return 0;
    }
    if (targetStart < scrollStart) {
      return -(scrollStart - targetStart + scrollPaddingStart);
    }
    if (targetEnd > scrollEnd) {
      return targetEnd - targetStart > scrollEnd - scrollStart ? targetStart + scrollPaddingStart - scrollStart : targetEnd - scrollEnd + scrollPaddingEnd;
    }
    return 0;
  };
  var scrollRectIntoView = (root2, targetRect) => {
    const document2 = root2.ownerDocument;
    let rect = targetRect;
    let current = root2;
    while (current) {
      const isDocumentBody = current === document2.body;
      const bounding = isDocumentBody ? {
        top: 0,
        right: window.visualViewport?.width ?? document2.documentElement.clientWidth,
        bottom: window.visualViewport?.height ?? document2.documentElement.clientHeight,
        left: 0
      } : getElementRect(current);
      const style = getComputedStyle(current);
      const scrollDistanceX = getScrollDistance(rect.left, rect.right, bounding.left, bounding.right, paddingValueToInt(style.scrollPaddingLeft), paddingValueToInt(style.scrollPaddingRight));
      const scrollDistanceY = getScrollDistance(rect.top, rect.bottom, bounding.top, bounding.bottom, paddingValueToInt(style.scrollPaddingTop), paddingValueToInt(style.scrollPaddingBottom));
      if (scrollDistanceX || scrollDistanceY) {
        if (isDocumentBody) {
          document2.defaultView?.scrollBy(scrollDistanceX, scrollDistanceY);
        } else {
          const {
            scrollLeft,
            scrollTop
          } = current;
          if (scrollDistanceY) {
            current.scrollTop += scrollDistanceY;
          }
          if (scrollDistanceX) {
            current.scrollLeft += scrollDistanceX;
          }
          const scrolledLeft = current.scrollLeft - scrollLeft;
          const scrolledTop = current.scrollTop - scrollTop;
          rect = {
            left: rect.left - scrolledLeft,
            top: rect.top - scrolledTop,
            right: rect.right - scrolledLeft,
            bottom: rect.bottom - scrolledTop
          };
        }
      }
      current = isDocumentBody || style.position === "fixed" ? null : getParentElement(current);
    }
  };
  var scrollRectIntoView_default = scrollRectIntoView;

  // node_modules/quill/core/utils/createRegistryWithFormats.js
  var MAX_REGISTER_ITERATIONS = 100;
  var CORE_FORMATS = ["block", "break", "cursor", "inline", "scroll", "text"];
  var createRegistryWithFormats = (formats, sourceRegistry, debug9) => {
    const registry = new Registry();
    CORE_FORMATS.forEach((name) => {
      const coreBlot = sourceRegistry.query(name);
      if (coreBlot)
        registry.register(coreBlot);
    });
    formats.forEach((name) => {
      let format = sourceRegistry.query(name);
      if (!format) {
        debug9.error(`Cannot register "${name}" specified in "formats" config. Are you sure it was registered?`);
      }
      let iterations = 0;
      while (format) {
        registry.register(format);
        format = "blotName" in format ? format.requiredContainer ?? null : null;
        iterations += 1;
        if (iterations > MAX_REGISTER_ITERATIONS) {
          debug9.error(`Cycle detected in registering blot requiredContainer: "${name}"`);
          break;
        }
      }
    });
    return registry;
  };
  var createRegistryWithFormats_default = createRegistryWithFormats;

  // node_modules/quill/core/quill.js
  var debug5 = logger_default("quill");
  var globalRegistry = new Registry();
  ParentBlot$1.uiClass = "ql-ui";
  var Quill = class _Quill {
    static DEFAULTS = {
      bounds: null,
      modules: {
        clipboard: true,
        keyboard: true,
        history: true,
        uploader: true
      },
      placeholder: "",
      readOnly: false,
      registry: globalRegistry,
      theme: "default"
    };
    static events = emitter_default.events;
    static sources = emitter_default.sources;
    static version = false ? "dev" : "2.0.2";
    static imports = {
      delta: import_quill_delta3.default,
      parchment: parchment_exports,
      "core/module": module_default,
      "core/theme": theme_default
    };
    static debug(limit) {
      if (limit === true) {
        limit = "log";
      }
      logger_default.level(limit);
    }
    static find(node) {
      let bubble = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      return instances_default.get(node) || globalRegistry.find(node, bubble);
    }
    static import(name) {
      if (this.imports[name] == null) {
        debug5.error(`Cannot import ${name}. Are you sure it was registered?`);
      }
      return this.imports[name];
    }
    static register() {
      if (typeof (arguments.length <= 0 ? void 0 : arguments[0]) !== "string") {
        const target = arguments.length <= 0 ? void 0 : arguments[0];
        const overwrite = !!(arguments.length <= 1 ? void 0 : arguments[1]);
        const name = "attrName" in target ? target.attrName : target.blotName;
        if (typeof name === "string") {
          this.register(`formats/${name}`, target, overwrite);
        } else {
          Object.keys(target).forEach((key) => {
            this.register(key, target[key], overwrite);
          });
        }
      } else {
        const path = arguments.length <= 0 ? void 0 : arguments[0];
        const target = arguments.length <= 1 ? void 0 : arguments[1];
        const overwrite = !!(arguments.length <= 2 ? void 0 : arguments[2]);
        if (this.imports[path] != null && !overwrite) {
          debug5.warn(`Overwriting ${path} with`, target);
        }
        this.imports[path] = target;
        if ((path.startsWith("blots/") || path.startsWith("formats/")) && target && typeof target !== "boolean" && target.blotName !== "abstract") {
          globalRegistry.register(target);
        }
        if (typeof target.register === "function") {
          target.register(globalRegistry);
        }
      }
    }
    constructor(container) {
      let options = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      this.options = expandConfig(container, options);
      this.container = this.options.container;
      if (this.container == null) {
        debug5.error("Invalid Quill container", container);
        return;
      }
      if (this.options.debug) {
        _Quill.debug(this.options.debug);
      }
      const html = this.container.innerHTML.trim();
      this.container.classList.add("ql-container");
      this.container.innerHTML = "";
      instances_default.set(this.container, this);
      this.root = this.addContainer("ql-editor");
      this.root.classList.add("ql-blank");
      this.emitter = new emitter_default();
      const scrollBlotName = ScrollBlot$1.blotName;
      const ScrollBlot2 = this.options.registry.query(scrollBlotName);
      if (!ScrollBlot2 || !("blotName" in ScrollBlot2)) {
        throw new Error(`Cannot initialize Quill without "${scrollBlotName}" blot`);
      }
      this.scroll = new ScrollBlot2(this.options.registry, this.root, {
        emitter: this.emitter
      });
      this.editor = new editor_default(this.scroll);
      this.selection = new selection_default(this.scroll, this.emitter);
      this.composition = new composition_default(this.scroll, this.emitter);
      this.theme = new this.options.theme(this, this.options);
      this.keyboard = this.theme.addModule("keyboard");
      this.clipboard = this.theme.addModule("clipboard");
      this.history = this.theme.addModule("history");
      this.uploader = this.theme.addModule("uploader");
      this.theme.addModule("input");
      this.theme.addModule("uiNode");
      this.theme.init();
      this.emitter.on(emitter_default.events.EDITOR_CHANGE, (type) => {
        if (type === emitter_default.events.TEXT_CHANGE) {
          this.root.classList.toggle("ql-blank", this.editor.isBlank());
        }
      });
      this.emitter.on(emitter_default.events.SCROLL_UPDATE, (source, mutations) => {
        const oldRange = this.selection.lastRange;
        const [newRange] = this.selection.getRange();
        const selectionInfo = oldRange && newRange ? {
          oldRange,
          newRange
        } : void 0;
        modify.call(this, () => this.editor.update(null, mutations, selectionInfo), source);
      });
      this.emitter.on(emitter_default.events.SCROLL_EMBED_UPDATE, (blot, delta) => {
        const oldRange = this.selection.lastRange;
        const [newRange] = this.selection.getRange();
        const selectionInfo = oldRange && newRange ? {
          oldRange,
          newRange
        } : void 0;
        modify.call(this, () => {
          const change = new import_quill_delta3.default().retain(blot.offset(this)).retain({
            [blot.statics.blotName]: delta
          });
          return this.editor.update(change, [], selectionInfo);
        }, _Quill.sources.USER);
      });
      if (html) {
        const contents = this.clipboard.convert({
          html: `${html}<p><br></p>`,
          text: "\n"
        });
        this.setContents(contents);
      }
      this.history.clear();
      if (this.options.placeholder) {
        this.root.setAttribute("data-placeholder", this.options.placeholder);
      }
      if (this.options.readOnly) {
        this.disable();
      }
      this.allowReadOnlyEdits = false;
    }
    addContainer(container) {
      let refNode = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
      if (typeof container === "string") {
        const className = container;
        container = document.createElement("div");
        container.classList.add(className);
      }
      this.container.insertBefore(container, refNode);
      return container;
    }
    blur() {
      this.selection.setRange(null);
    }
    deleteText(index, length, source) {
      [index, length, , source] = overload(index, length, source);
      return modify.call(this, () => {
        return this.editor.deleteText(index, length);
      }, source, index, -1 * length);
    }
    disable() {
      this.enable(false);
    }
    editReadOnly(modifier) {
      this.allowReadOnlyEdits = true;
      const value = modifier();
      this.allowReadOnlyEdits = false;
      return value;
    }
    enable() {
      let enabled = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true;
      this.scroll.enable(enabled);
      this.container.classList.toggle("ql-disabled", !enabled);
    }
    focus() {
      let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      this.selection.focus();
      if (!options.preventScroll) {
        this.scrollSelectionIntoView();
      }
    }
    format(name, value) {
      let source = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : emitter_default.sources.API;
      return modify.call(this, () => {
        const range = this.getSelection(true);
        let change = new import_quill_delta3.default();
        if (range == null)
          return change;
        if (this.scroll.query(name, Scope.BLOCK)) {
          change = this.editor.formatLine(range.index, range.length, {
            [name]: value
          });
        } else if (range.length === 0) {
          this.selection.format(name, value);
          return change;
        } else {
          change = this.editor.formatText(range.index, range.length, {
            [name]: value
          });
        }
        this.setSelection(range, emitter_default.sources.SILENT);
        return change;
      }, source);
    }
    formatLine(index, length, name, value, source) {
      let formats;
      [index, length, formats, source] = overload(
        index,
        length,
        // @ts-expect-error
        name,
        value,
        source
      );
      return modify.call(this, () => {
        return this.editor.formatLine(index, length, formats);
      }, source, index, 0);
    }
    formatText(index, length, name, value, source) {
      let formats;
      [index, length, formats, source] = overload(
        // @ts-expect-error
        index,
        length,
        name,
        value,
        source
      );
      return modify.call(this, () => {
        return this.editor.formatText(index, length, formats);
      }, source, index, 0);
    }
    getBounds(index) {
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      let bounds = null;
      if (typeof index === "number") {
        bounds = this.selection.getBounds(index, length);
      } else {
        bounds = this.selection.getBounds(index.index, index.length);
      }
      if (!bounds)
        return null;
      const containerBounds = this.container.getBoundingClientRect();
      return {
        bottom: bounds.bottom - containerBounds.top,
        height: bounds.height,
        left: bounds.left - containerBounds.left,
        right: bounds.right - containerBounds.left,
        top: bounds.top - containerBounds.top,
        width: bounds.width
      };
    }
    getContents() {
      let index = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : this.getLength() - index;
      [index, length] = overload(index, length);
      return this.editor.getContents(index, length);
    }
    getFormat() {
      let index = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.getSelection(true);
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
      if (typeof index === "number") {
        return this.editor.getFormat(index, length);
      }
      return this.editor.getFormat(index.index, index.length);
    }
    getIndex(blot) {
      return blot.offset(this.scroll);
    }
    getLength() {
      return this.scroll.length();
    }
    getLeaf(index) {
      return this.scroll.leaf(index);
    }
    getLine(index) {
      return this.scroll.line(index);
    }
    getLines() {
      let index = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Number.MAX_VALUE;
      if (typeof index !== "number") {
        return this.scroll.lines(index.index, index.length);
      }
      return this.scroll.lines(index, length);
    }
    getModule(name) {
      return this.theme.modules[name];
    }
    getSelection() {
      let focus = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : false;
      if (focus)
        this.focus();
      this.update();
      return this.selection.getRange()[0];
    }
    getSemanticHTML() {
      let index = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      let length = arguments.length > 1 ? arguments[1] : void 0;
      if (typeof index === "number") {
        length = length ?? this.getLength() - index;
      }
      [index, length] = overload(index, length);
      return this.editor.getHTML(index, length);
    }
    getText() {
      let index = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      let length = arguments.length > 1 ? arguments[1] : void 0;
      if (typeof index === "number") {
        length = length ?? this.getLength() - index;
      }
      [index, length] = overload(index, length);
      return this.editor.getText(index, length);
    }
    hasFocus() {
      return this.selection.hasFocus();
    }
    insertEmbed(index, embed, value) {
      let source = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : _Quill.sources.API;
      return modify.call(this, () => {
        return this.editor.insertEmbed(index, embed, value);
      }, source, index);
    }
    insertText(index, text, name, value, source) {
      let formats;
      [index, , formats, source] = overload(index, 0, name, value, source);
      return modify.call(this, () => {
        return this.editor.insertText(index, text, formats);
      }, source, index, text.length);
    }
    isEnabled() {
      return this.scroll.isEnabled();
    }
    off() {
      return this.emitter.off(...arguments);
    }
    on() {
      return this.emitter.on(...arguments);
    }
    once() {
      return this.emitter.once(...arguments);
    }
    removeFormat(index, length, source) {
      [index, length, , source] = overload(index, length, source);
      return modify.call(this, () => {
        return this.editor.removeFormat(index, length);
      }, source, index);
    }
    scrollRectIntoView(rect) {
      scrollRectIntoView_default(this.root, rect);
    }
    /**
     * @deprecated Use Quill#scrollSelectionIntoView() instead.
     */
    scrollIntoView() {
      console.warn("Quill#scrollIntoView() has been deprecated and will be removed in the near future. Please use Quill#scrollSelectionIntoView() instead.");
      this.scrollSelectionIntoView();
    }
    /**
     * Scroll the current selection into the visible area.
     * If the selection is already visible, no scrolling will occur.
     */
    scrollSelectionIntoView() {
      const range = this.selection.lastRange;
      const bounds = range && this.selection.getBounds(range.index, range.length);
      if (bounds) {
        this.scrollRectIntoView(bounds);
      }
    }
    setContents(delta) {
      let source = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : emitter_default.sources.API;
      return modify.call(this, () => {
        delta = new import_quill_delta3.default(delta);
        const length = this.getLength();
        const delete1 = this.editor.deleteText(0, length);
        const applied = this.editor.insertContents(0, delta);
        const delete2 = this.editor.deleteText(this.getLength() - 1, 1);
        return delete1.compose(applied).compose(delete2);
      }, source);
    }
    setSelection(index, length, source) {
      if (index == null) {
        this.selection.setRange(null, length || _Quill.sources.API);
      } else {
        [index, length, , source] = overload(index, length, source);
        this.selection.setRange(new Range(Math.max(0, index), length), source);
        if (source !== emitter_default.sources.SILENT) {
          this.scrollSelectionIntoView();
        }
      }
    }
    setText(text) {
      let source = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : emitter_default.sources.API;
      const delta = new import_quill_delta3.default().insert(text);
      return this.setContents(delta, source);
    }
    update() {
      let source = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : emitter_default.sources.USER;
      const change = this.scroll.update(source);
      this.selection.update(source);
      return change;
    }
    updateContents(delta) {
      let source = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : emitter_default.sources.API;
      return modify.call(this, () => {
        delta = new import_quill_delta3.default(delta);
        return this.editor.applyDelta(delta);
      }, source, true);
    }
  };
  function resolveSelector(selector) {
    return typeof selector === "string" ? document.querySelector(selector) : selector;
  }
  function expandModuleConfig(config4) {
    return Object.entries(config4 ?? {}).reduce((expanded, _ref) => {
      let [key, value] = _ref;
      return {
        ...expanded,
        [key]: value === true ? {} : value
      };
    }, {});
  }
  function omitUndefinedValuesFromOptions(obj) {
    return Object.fromEntries(Object.entries(obj).filter((entry) => entry[1] !== void 0));
  }
  function expandConfig(containerOrSelector, options) {
    const container = resolveSelector(containerOrSelector);
    if (!container) {
      throw new Error("Invalid Quill container");
    }
    const shouldUseDefaultTheme = !options.theme || options.theme === Quill.DEFAULTS.theme;
    const theme = shouldUseDefaultTheme ? theme_default : Quill.import(`themes/${options.theme}`);
    if (!theme) {
      throw new Error(`Invalid theme ${options.theme}. Did you register it?`);
    }
    const {
      modules: quillModuleDefaults,
      ...quillDefaults
    } = Quill.DEFAULTS;
    const {
      modules: themeModuleDefaults,
      ...themeDefaults
    } = theme.DEFAULTS;
    let userModuleOptions = expandModuleConfig(options.modules);
    if (userModuleOptions != null && userModuleOptions.toolbar && userModuleOptions.toolbar.constructor !== Object) {
      userModuleOptions = {
        ...userModuleOptions,
        toolbar: {
          container: userModuleOptions.toolbar
        }
      };
    }
    const modules = merge_default({}, expandModuleConfig(quillModuleDefaults), expandModuleConfig(themeModuleDefaults), userModuleOptions);
    const config4 = {
      ...quillDefaults,
      ...omitUndefinedValuesFromOptions(themeDefaults),
      ...omitUndefinedValuesFromOptions(options)
    };
    let registry = options.registry;
    if (registry) {
      if (options.formats) {
        debug5.warn('Ignoring "formats" option because "registry" is specified');
      }
    } else {
      registry = options.formats ? createRegistryWithFormats_default(options.formats, config4.registry, debug5) : config4.registry;
    }
    return {
      ...config4,
      registry,
      container,
      theme,
      modules: Object.entries(modules).reduce((modulesWithDefaults, _ref2) => {
        let [name, value] = _ref2;
        if (!value)
          return modulesWithDefaults;
        const moduleClass = Quill.import(`modules/${name}`);
        if (moduleClass == null) {
          debug5.error(`Cannot load ${name} module. Are you sure you registered it?`);
          return modulesWithDefaults;
        }
        return {
          ...modulesWithDefaults,
          // @ts-expect-error
          [name]: merge_default({}, moduleClass.DEFAULTS || {}, value)
        };
      }, {}),
      bounds: resolveSelector(config4.bounds)
    };
  }
  function modify(modifier, source, index, shift) {
    if (!this.isEnabled() && source === emitter_default.sources.USER && !this.allowReadOnlyEdits) {
      return new import_quill_delta3.default();
    }
    let range = index == null ? null : this.getSelection();
    const oldDelta = this.editor.delta;
    const change = modifier();
    if (range != null) {
      if (index === true) {
        index = range.index;
      }
      if (shift == null) {
        range = shiftRange2(range, change, source);
      } else if (shift !== 0) {
        range = shiftRange2(range, index, shift, source);
      }
      this.setSelection(range, emitter_default.sources.SILENT);
    }
    if (change.length() > 0) {
      const args = [emitter_default.events.TEXT_CHANGE, change, oldDelta, source];
      this.emitter.emit(emitter_default.events.EDITOR_CHANGE, ...args);
      if (source !== emitter_default.sources.SILENT) {
        this.emitter.emit(...args);
      }
    }
    return change;
  }
  function overload(index, length, name, value, source) {
    let formats = {};
    if (typeof index.index === "number" && typeof index.length === "number") {
      if (typeof length !== "number") {
        source = value;
        value = name;
        name = length;
        length = index.length;
        index = index.index;
      } else {
        length = index.length;
        index = index.index;
      }
    } else if (typeof length !== "number") {
      source = value;
      value = name;
      name = length;
      length = 0;
    }
    if (typeof name === "object") {
      formats = name;
      source = value;
    } else if (typeof name === "string") {
      if (value != null) {
        formats[name] = value;
      } else {
        source = name;
      }
    }
    source = source || emitter_default.sources.API;
    return [index, length, formats, source];
  }
  function shiftRange2(range, index, lengthOrSource, source) {
    const length = typeof lengthOrSource === "number" ? lengthOrSource : 0;
    if (range == null)
      return null;
    let start;
    let end;
    if (index && typeof index.transformPosition === "function") {
      [start, end] = [range.index, range.index + range.length].map((pos) => (
        // @ts-expect-error -- TODO: add a better type guard around `index`
        index.transformPosition(pos, source !== emitter_default.sources.USER)
      ));
    } else {
      [start, end] = [range.index, range.index + range.length].map((pos) => {
        if (pos < index || pos === index && source === emitter_default.sources.USER)
          return pos;
        if (length >= 0) {
          return pos + length;
        }
        return Math.max(index, pos + length);
      });
    }
    return new Range(start, end - start);
  }

  // node_modules/quill/blots/container.js
  var Container = class extends ContainerBlot$1 {
  };
  var container_default = Container;

  // node_modules/quill/blots/scroll.js
  var import_quill_delta4 = __toESM(require_Delta(), 1);
  function isLine(blot) {
    return blot instanceof Block || blot instanceof BlockEmbed;
  }
  function isUpdatable(blot) {
    return typeof blot.updateContent === "function";
  }
  var Scroll = class extends ScrollBlot$1 {
    static blotName = "scroll";
    static className = "ql-editor";
    static tagName = "DIV";
    static defaultChild = Block;
    static allowedChildren = [Block, BlockEmbed, container_default];
    constructor(registry, domNode, _ref) {
      let {
        emitter
      } = _ref;
      super(registry, domNode);
      this.emitter = emitter;
      this.batch = false;
      this.optimize();
      this.enable();
      this.domNode.addEventListener("dragstart", (e) => this.handleDragStart(e));
    }
    batchStart() {
      if (!Array.isArray(this.batch)) {
        this.batch = [];
      }
    }
    batchEnd() {
      if (!this.batch)
        return;
      const mutations = this.batch;
      this.batch = false;
      this.update(mutations);
    }
    emitMount(blot) {
      this.emitter.emit(emitter_default.events.SCROLL_BLOT_MOUNT, blot);
    }
    emitUnmount(blot) {
      this.emitter.emit(emitter_default.events.SCROLL_BLOT_UNMOUNT, blot);
    }
    emitEmbedUpdate(blot, change) {
      this.emitter.emit(emitter_default.events.SCROLL_EMBED_UPDATE, blot, change);
    }
    deleteAt(index, length) {
      const [first, offset] = this.line(index);
      const [last] = this.line(index + length);
      super.deleteAt(index, length);
      if (last != null && first !== last && offset > 0) {
        if (first instanceof BlockEmbed || last instanceof BlockEmbed) {
          this.optimize();
          return;
        }
        const ref = last.children.head instanceof break_default ? null : last.children.head;
        first.moveChildren(last, ref);
        first.remove();
      }
      this.optimize();
    }
    enable() {
      let enabled = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true;
      this.domNode.setAttribute("contenteditable", enabled ? "true" : "false");
    }
    formatAt(index, length, format, value) {
      super.formatAt(index, length, format, value);
      this.optimize();
    }
    insertAt(index, value, def) {
      if (index >= this.length()) {
        if (def == null || this.scroll.query(value, Scope.BLOCK) == null) {
          const blot = this.scroll.create(this.statics.defaultChild.blotName);
          this.appendChild(blot);
          if (def == null && value.endsWith("\n")) {
            blot.insertAt(0, value.slice(0, -1), def);
          } else {
            blot.insertAt(0, value, def);
          }
        } else {
          const embed = this.scroll.create(value, def);
          this.appendChild(embed);
        }
      } else {
        super.insertAt(index, value, def);
      }
      this.optimize();
    }
    insertBefore(blot, ref) {
      if (blot.statics.scope === Scope.INLINE_BLOT) {
        const wrapper = this.scroll.create(this.statics.defaultChild.blotName);
        wrapper.appendChild(blot);
        super.insertBefore(wrapper, ref);
      } else {
        super.insertBefore(blot, ref);
      }
    }
    insertContents(index, delta) {
      const renderBlocks = this.deltaToRenderBlocks(delta.concat(new import_quill_delta4.default().insert("\n")));
      const last = renderBlocks.pop();
      if (last == null)
        return;
      this.batchStart();
      const first = renderBlocks.shift();
      if (first) {
        const shouldInsertNewlineChar = first.type === "block" && (first.delta.length() === 0 || !this.descendant(BlockEmbed, index)[0] && index < this.length());
        const delta2 = first.type === "block" ? first.delta : new import_quill_delta4.default().insert({
          [first.key]: first.value
        });
        insertInlineContents(this, index, delta2);
        const newlineCharLength = first.type === "block" ? 1 : 0;
        const lineEndIndex = index + delta2.length() + newlineCharLength;
        if (shouldInsertNewlineChar) {
          this.insertAt(lineEndIndex - 1, "\n");
        }
        const formats = bubbleFormats(this.line(index)[0]);
        const attributes = import_quill_delta4.AttributeMap.diff(formats, first.attributes) || {};
        Object.keys(attributes).forEach((name) => {
          this.formatAt(lineEndIndex - 1, 1, name, attributes[name]);
        });
        index = lineEndIndex;
      }
      let [refBlot, refBlotOffset] = this.children.find(index);
      if (renderBlocks.length) {
        if (refBlot) {
          refBlot = refBlot.split(refBlotOffset);
          refBlotOffset = 0;
        }
        renderBlocks.forEach((renderBlock) => {
          if (renderBlock.type === "block") {
            const block = this.createBlock(renderBlock.attributes, refBlot || void 0);
            insertInlineContents(block, 0, renderBlock.delta);
          } else {
            const blockEmbed = this.create(renderBlock.key, renderBlock.value);
            this.insertBefore(blockEmbed, refBlot || void 0);
            Object.keys(renderBlock.attributes).forEach((name) => {
              blockEmbed.format(name, renderBlock.attributes[name]);
            });
          }
        });
      }
      if (last.type === "block" && last.delta.length()) {
        const offset = refBlot ? refBlot.offset(refBlot.scroll) + refBlotOffset : this.length();
        insertInlineContents(this, offset, last.delta);
      }
      this.batchEnd();
      this.optimize();
    }
    isEnabled() {
      return this.domNode.getAttribute("contenteditable") === "true";
    }
    leaf(index) {
      const last = this.path(index).pop();
      if (!last) {
        return [null, -1];
      }
      const [blot, offset] = last;
      return blot instanceof LeafBlot$1 ? [blot, offset] : [null, -1];
    }
    line(index) {
      if (index === this.length()) {
        return this.line(index - 1);
      }
      return this.descendant(isLine, index);
    }
    lines() {
      let index = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
      let length = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : Number.MAX_VALUE;
      const getLines = (blot, blotIndex, blotLength) => {
        let lines = [];
        let lengthLeft = blotLength;
        blot.children.forEachAt(blotIndex, blotLength, (child, childIndex, childLength) => {
          if (isLine(child)) {
            lines.push(child);
          } else if (child instanceof ContainerBlot$1) {
            lines = lines.concat(getLines(child, childIndex, lengthLeft));
          }
          lengthLeft -= childLength;
        });
        return lines;
      };
      return getLines(this, index, length);
    }
    optimize() {
      let mutations = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : [];
      let context = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      if (this.batch)
        return;
      super.optimize(mutations, context);
      if (mutations.length > 0) {
        this.emitter.emit(emitter_default.events.SCROLL_OPTIMIZE, mutations, context);
      }
    }
    path(index) {
      return super.path(index).slice(1);
    }
    remove() {
    }
    update(mutations) {
      if (this.batch) {
        if (Array.isArray(mutations)) {
          this.batch = this.batch.concat(mutations);
        }
        return;
      }
      let source = emitter_default.sources.USER;
      if (typeof mutations === "string") {
        source = mutations;
      }
      if (!Array.isArray(mutations)) {
        mutations = this.observer.takeRecords();
      }
      mutations = mutations.filter((_ref2) => {
        let {
          target
        } = _ref2;
        const blot = this.find(target, true);
        return blot && !isUpdatable(blot);
      });
      if (mutations.length > 0) {
        this.emitter.emit(emitter_default.events.SCROLL_BEFORE_UPDATE, source, mutations);
      }
      super.update(mutations.concat([]));
      if (mutations.length > 0) {
        this.emitter.emit(emitter_default.events.SCROLL_UPDATE, source, mutations);
      }
    }
    updateEmbedAt(index, key, change) {
      const [blot] = this.descendant((b) => b instanceof BlockEmbed, index);
      if (blot && blot.statics.blotName === key && isUpdatable(blot)) {
        blot.updateContent(change);
      }
    }
    handleDragStart(event) {
      event.preventDefault();
    }
    deltaToRenderBlocks(delta) {
      const renderBlocks = [];
      let currentBlockDelta = new import_quill_delta4.default();
      delta.forEach((op) => {
        const insert = op?.insert;
        if (!insert)
          return;
        if (typeof insert === "string") {
          const splitted = insert.split("\n");
          splitted.slice(0, -1).forEach((text) => {
            currentBlockDelta.insert(text, op.attributes);
            renderBlocks.push({
              type: "block",
              delta: currentBlockDelta,
              attributes: op.attributes ?? {}
            });
            currentBlockDelta = new import_quill_delta4.default();
          });
          const last = splitted[splitted.length - 1];
          if (last) {
            currentBlockDelta.insert(last, op.attributes);
          }
        } else {
          const key = Object.keys(insert)[0];
          if (!key)
            return;
          if (this.query(key, Scope.INLINE)) {
            currentBlockDelta.push(op);
          } else {
            if (currentBlockDelta.length()) {
              renderBlocks.push({
                type: "block",
                delta: currentBlockDelta,
                attributes: {}
              });
            }
            currentBlockDelta = new import_quill_delta4.default();
            renderBlocks.push({
              type: "blockEmbed",
              key,
              value: insert[key],
              attributes: op.attributes ?? {}
            });
          }
        }
      });
      if (currentBlockDelta.length()) {
        renderBlocks.push({
          type: "block",
          delta: currentBlockDelta,
          attributes: {}
        });
      }
      return renderBlocks;
    }
    createBlock(attributes, refBlot) {
      let blotName;
      const formats = {};
      Object.entries(attributes).forEach((_ref3) => {
        let [key, value] = _ref3;
        const isBlockBlot = this.query(key, Scope.BLOCK & Scope.BLOT) != null;
        if (isBlockBlot) {
          blotName = key;
        } else {
          formats[key] = value;
        }
      });
      const block = this.create(blotName || this.statics.defaultChild.blotName, blotName ? attributes[blotName] : void 0);
      this.insertBefore(block, refBlot || void 0);
      const length = block.length();
      Object.entries(formats).forEach((_ref4) => {
        let [key, value] = _ref4;
        block.formatAt(0, length, key, value);
      });
      return block;
    }
  };
  function insertInlineContents(parent, index, inlineContents) {
    inlineContents.reduce((index2, op) => {
      const length = import_quill_delta4.Op.length(op);
      let attributes = op.attributes || {};
      if (op.insert != null) {
        if (typeof op.insert === "string") {
          const text = op.insert;
          parent.insertAt(index2, text);
          const [leaf] = parent.descendant(LeafBlot$1, index2);
          const formats = bubbleFormats(leaf);
          attributes = import_quill_delta4.AttributeMap.diff(formats, attributes) || {};
        } else if (typeof op.insert === "object") {
          const key = Object.keys(op.insert)[0];
          if (key == null)
            return index2;
          parent.insertAt(index2, key, op.insert[key]);
          const isInlineEmbed = parent.scroll.query(key, Scope.INLINE) != null;
          if (isInlineEmbed) {
            const [leaf] = parent.descendant(LeafBlot$1, index2);
            const formats = bubbleFormats(leaf);
            attributes = import_quill_delta4.AttributeMap.diff(formats, attributes) || {};
          }
        }
      }
      Object.keys(attributes).forEach((key) => {
        parent.formatAt(index2, length, key, attributes[key]);
      });
      return index2 + length;
    }, index);
  }
  var scroll_default = Scroll;

  // node_modules/quill/modules/clipboard.js
  var import_quill_delta6 = __toESM(require_Delta(), 1);

  // node_modules/quill/formats/align.js
  var config = {
    scope: Scope.BLOCK,
    whitelist: ["right", "center", "justify"]
  };
  var AlignAttribute = new Attributor("align", "align", config);
  var AlignClass = new ClassAttributor$1("align", "ql-align", config);
  var AlignStyle = new StyleAttributor$1("align", "text-align", config);

  // node_modules/quill/formats/color.js
  var ColorAttributor = class extends StyleAttributor$1 {
    value(domNode) {
      let value = super.value(domNode);
      if (!value.startsWith("rgb("))
        return value;
      value = value.replace(/^[^\d]+/, "").replace(/[^\d]+$/, "");
      const hex = value.split(",").map((component) => `00${parseInt(component, 10).toString(16)}`.slice(-2)).join("");
      return `#${hex}`;
    }
  };
  var ColorClass = new ClassAttributor$1("color", "ql-color", {
    scope: Scope.INLINE
  });
  var ColorStyle = new ColorAttributor("color", "color", {
    scope: Scope.INLINE
  });

  // node_modules/quill/formats/background.js
  var BackgroundClass = new ClassAttributor$1("background", "ql-bg", {
    scope: Scope.INLINE
  });
  var BackgroundStyle = new ColorAttributor("background", "background-color", {
    scope: Scope.INLINE
  });

  // node_modules/quill/formats/code.js
  var CodeBlockContainer = class extends container_default {
    static create(value) {
      const domNode = super.create(value);
      domNode.setAttribute("spellcheck", "false");
      return domNode;
    }
    code(index, length) {
      return this.children.map((child) => child.length() <= 1 ? "" : child.domNode.innerText).join("\n").slice(index, index + length);
    }
    html(index, length) {
      return `<pre>
${escapeText(this.code(index, length))}
</pre>`;
    }
  };
  var CodeBlock = class extends Block {
    static TAB = "  ";
    static register() {
      Quill.register(CodeBlockContainer);
    }
  };
  var Code = class extends inline_default {
  };
  Code.blotName = "code";
  Code.tagName = "CODE";
  CodeBlock.blotName = "code-block";
  CodeBlock.className = "ql-code-block";
  CodeBlock.tagName = "DIV";
  CodeBlockContainer.blotName = "code-block-container";
  CodeBlockContainer.className = "ql-code-block-container";
  CodeBlockContainer.tagName = "DIV";
  CodeBlockContainer.allowedChildren = [CodeBlock];
  CodeBlock.allowedChildren = [Text2, break_default, cursor_default];
  CodeBlock.requiredContainer = CodeBlockContainer;

  // node_modules/quill/formats/direction.js
  var config2 = {
    scope: Scope.BLOCK,
    whitelist: ["rtl"]
  };
  var DirectionAttribute = new Attributor("direction", "dir", config2);
  var DirectionClass = new ClassAttributor$1("direction", "ql-direction", config2);
  var DirectionStyle = new StyleAttributor$1("direction", "direction", config2);

  // node_modules/quill/formats/font.js
  var config3 = {
    scope: Scope.INLINE,
    whitelist: ["serif", "monospace"]
  };
  var FontClass = new ClassAttributor$1("font", "ql-font", config3);
  var FontStyleAttributor = class extends StyleAttributor$1 {
    value(node) {
      return super.value(node).replace(/["']/g, "");
    }
  };
  var FontStyle = new FontStyleAttributor("font", "font-family", config3);

  // node_modules/quill/formats/size.js
  var SizeClass = new ClassAttributor$1("size", "ql-size", {
    scope: Scope.INLINE,
    whitelist: ["small", "large", "huge"]
  });
  var SizeStyle = new StyleAttributor$1("size", "font-size", {
    scope: Scope.INLINE,
    whitelist: ["10px", "18px", "32px"]
  });

  // node_modules/quill/modules/keyboard.js
  var import_quill_delta5 = __toESM(require_Delta(), 1);
  var debug6 = logger_default("quill:keyboard");
  var SHORTKEY = /Mac/i.test(navigator.platform) ? "metaKey" : "ctrlKey";
  var Keyboard = class _Keyboard extends module_default {
    static match(evt, binding) {
      if (["altKey", "ctrlKey", "metaKey", "shiftKey"].some((key) => {
        return !!binding[key] !== evt[key] && binding[key] !== null;
      })) {
        return false;
      }
      return binding.key === evt.key || binding.key === evt.which;
    }
    constructor(quill, options) {
      super(quill, options);
      this.bindings = {};
      Object.keys(this.options.bindings).forEach((name) => {
        if (this.options.bindings[name]) {
          this.addBinding(this.options.bindings[name]);
        }
      });
      this.addBinding({
        key: "Enter",
        shiftKey: null
      }, this.handleEnter);
      this.addBinding({
        key: "Enter",
        metaKey: null,
        ctrlKey: null,
        altKey: null
      }, () => {
      });
      if (/Firefox/i.test(navigator.userAgent)) {
        this.addBinding({
          key: "Backspace"
        }, {
          collapsed: true
        }, this.handleBackspace);
        this.addBinding({
          key: "Delete"
        }, {
          collapsed: true
        }, this.handleDelete);
      } else {
        this.addBinding({
          key: "Backspace"
        }, {
          collapsed: true,
          prefix: /^.?$/
        }, this.handleBackspace);
        this.addBinding({
          key: "Delete"
        }, {
          collapsed: true,
          suffix: /^.?$/
        }, this.handleDelete);
      }
      this.addBinding({
        key: "Backspace"
      }, {
        collapsed: false
      }, this.handleDeleteRange);
      this.addBinding({
        key: "Delete"
      }, {
        collapsed: false
      }, this.handleDeleteRange);
      this.addBinding({
        key: "Backspace",
        altKey: null,
        ctrlKey: null,
        metaKey: null,
        shiftKey: null
      }, {
        collapsed: true,
        offset: 0
      }, this.handleBackspace);
      this.listen();
    }
    addBinding(keyBinding) {
      let context = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let handler = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
      const binding = normalize(keyBinding);
      if (binding == null) {
        debug6.warn("Attempted to add invalid keyboard binding", binding);
        return;
      }
      if (typeof context === "function") {
        context = {
          handler: context
        };
      }
      if (typeof handler === "function") {
        handler = {
          handler
        };
      }
      const keys2 = Array.isArray(binding.key) ? binding.key : [binding.key];
      keys2.forEach((key) => {
        const singleBinding = {
          ...binding,
          key,
          ...context,
          ...handler
        };
        this.bindings[singleBinding.key] = this.bindings[singleBinding.key] || [];
        this.bindings[singleBinding.key].push(singleBinding);
      });
    }
    listen() {
      this.quill.root.addEventListener("keydown", (evt) => {
        if (evt.defaultPrevented || evt.isComposing)
          return;
        const isComposing = evt.keyCode === 229 && (evt.key === "Enter" || evt.key === "Backspace");
        if (isComposing)
          return;
        const bindings = (this.bindings[evt.key] || []).concat(this.bindings[evt.which] || []);
        const matches = bindings.filter((binding) => _Keyboard.match(evt, binding));
        if (matches.length === 0)
          return;
        const blot = Quill.find(evt.target, true);
        if (blot && blot.scroll !== this.quill.scroll)
          return;
        const range = this.quill.getSelection();
        if (range == null || !this.quill.hasFocus())
          return;
        const [line, offset] = this.quill.getLine(range.index);
        const [leafStart, offsetStart] = this.quill.getLeaf(range.index);
        const [leafEnd, offsetEnd] = range.length === 0 ? [leafStart, offsetStart] : this.quill.getLeaf(range.index + range.length);
        const prefixText = leafStart instanceof TextBlot$1 ? leafStart.value().slice(0, offsetStart) : "";
        const suffixText = leafEnd instanceof TextBlot$1 ? leafEnd.value().slice(offsetEnd) : "";
        const curContext = {
          collapsed: range.length === 0,
          // @ts-expect-error Fix me later
          empty: range.length === 0 && line.length() <= 1,
          format: this.quill.getFormat(range),
          line,
          offset,
          prefix: prefixText,
          suffix: suffixText,
          event: evt
        };
        const prevented = matches.some((binding) => {
          if (binding.collapsed != null && binding.collapsed !== curContext.collapsed) {
            return false;
          }
          if (binding.empty != null && binding.empty !== curContext.empty) {
            return false;
          }
          if (binding.offset != null && binding.offset !== curContext.offset) {
            return false;
          }
          if (Array.isArray(binding.format)) {
            if (binding.format.every((name) => curContext.format[name] == null)) {
              return false;
            }
          } else if (typeof binding.format === "object") {
            if (!Object.keys(binding.format).every((name) => {
              if (binding.format[name] === true)
                return curContext.format[name] != null;
              if (binding.format[name] === false)
                return curContext.format[name] == null;
              return isEqual_default(binding.format[name], curContext.format[name]);
            })) {
              return false;
            }
          }
          if (binding.prefix != null && !binding.prefix.test(curContext.prefix)) {
            return false;
          }
          if (binding.suffix != null && !binding.suffix.test(curContext.suffix)) {
            return false;
          }
          return binding.handler.call(this, range, curContext, binding) !== true;
        });
        if (prevented) {
          evt.preventDefault();
        }
      });
    }
    handleBackspace(range, context) {
      const length = /[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(context.prefix) ? 2 : 1;
      if (range.index === 0 || this.quill.getLength() <= 1)
        return;
      let formats = {};
      const [line] = this.quill.getLine(range.index);
      let delta = new import_quill_delta5.default().retain(range.index - length).delete(length);
      if (context.offset === 0) {
        const [prev] = this.quill.getLine(range.index - 1);
        if (prev) {
          const isPrevLineEmpty = prev.statics.blotName === "block" && prev.length() <= 1;
          if (!isPrevLineEmpty) {
            const curFormats = line.formats();
            const prevFormats = this.quill.getFormat(range.index - 1, 1);
            formats = import_quill_delta5.AttributeMap.diff(curFormats, prevFormats) || {};
            if (Object.keys(formats).length > 0) {
              const formatDelta = new import_quill_delta5.default().retain(range.index + line.length() - 2).retain(1, formats);
              delta = delta.compose(formatDelta);
            }
          }
        }
      }
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.focus();
    }
    handleDelete(range, context) {
      const length = /^[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(context.suffix) ? 2 : 1;
      if (range.index >= this.quill.getLength() - length)
        return;
      let formats = {};
      const [line] = this.quill.getLine(range.index);
      let delta = new import_quill_delta5.default().retain(range.index).delete(length);
      if (context.offset >= line.length() - 1) {
        const [next] = this.quill.getLine(range.index + 1);
        if (next) {
          const curFormats = line.formats();
          const nextFormats = this.quill.getFormat(range.index, 1);
          formats = import_quill_delta5.AttributeMap.diff(curFormats, nextFormats) || {};
          if (Object.keys(formats).length > 0) {
            delta = delta.retain(next.length() - 1).retain(1, formats);
          }
        }
      }
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.focus();
    }
    handleDeleteRange(range) {
      deleteRange({
        range,
        quill: this.quill
      });
      this.quill.focus();
    }
    handleEnter(range, context) {
      const lineFormats = Object.keys(context.format).reduce((formats, format) => {
        if (this.quill.scroll.query(format, Scope.BLOCK) && !Array.isArray(context.format[format])) {
          formats[format] = context.format[format];
        }
        return formats;
      }, {});
      const delta = new import_quill_delta5.default().retain(range.index).delete(range.length).insert("\n", lineFormats);
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
      this.quill.focus();
    }
  };
  var defaultOptions = {
    bindings: {
      bold: makeFormatHandler("bold"),
      italic: makeFormatHandler("italic"),
      underline: makeFormatHandler("underline"),
      indent: {
        // highlight tab or tab at beginning of list, indent or blockquote
        key: "Tab",
        format: ["blockquote", "indent", "list"],
        handler(range, context) {
          if (context.collapsed && context.offset !== 0)
            return true;
          this.quill.format("indent", "+1", Quill.sources.USER);
          return false;
        }
      },
      outdent: {
        key: "Tab",
        shiftKey: true,
        format: ["blockquote", "indent", "list"],
        // highlight tab or tab at beginning of list, indent or blockquote
        handler(range, context) {
          if (context.collapsed && context.offset !== 0)
            return true;
          this.quill.format("indent", "-1", Quill.sources.USER);
          return false;
        }
      },
      "outdent backspace": {
        key: "Backspace",
        collapsed: true,
        shiftKey: null,
        metaKey: null,
        ctrlKey: null,
        altKey: null,
        format: ["indent", "list"],
        offset: 0,
        handler(range, context) {
          if (context.format.indent != null) {
            this.quill.format("indent", "-1", Quill.sources.USER);
          } else if (context.format.list != null) {
            this.quill.format("list", false, Quill.sources.USER);
          }
        }
      },
      "indent code-block": makeCodeBlockHandler(true),
      "outdent code-block": makeCodeBlockHandler(false),
      "remove tab": {
        key: "Tab",
        shiftKey: true,
        collapsed: true,
        prefix: /\t$/,
        handler(range) {
          this.quill.deleteText(range.index - 1, 1, Quill.sources.USER);
        }
      },
      tab: {
        key: "Tab",
        handler(range, context) {
          if (context.format.table)
            return true;
          this.quill.history.cutoff();
          const delta = new import_quill_delta5.default().retain(range.index).delete(range.length).insert("	");
          this.quill.updateContents(delta, Quill.sources.USER);
          this.quill.history.cutoff();
          this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
          return false;
        }
      },
      "blockquote empty enter": {
        key: "Enter",
        collapsed: true,
        format: ["blockquote"],
        empty: true,
        handler() {
          this.quill.format("blockquote", false, Quill.sources.USER);
        }
      },
      "list empty enter": {
        key: "Enter",
        collapsed: true,
        format: ["list"],
        empty: true,
        handler(range, context) {
          const formats = {
            list: false
          };
          if (context.format.indent) {
            formats.indent = false;
          }
          this.quill.formatLine(range.index, range.length, formats, Quill.sources.USER);
        }
      },
      "checklist enter": {
        key: "Enter",
        collapsed: true,
        format: {
          list: "checked"
        },
        handler(range) {
          const [line, offset] = this.quill.getLine(range.index);
          const formats = {
            // @ts-expect-error Fix me later
            ...line.formats(),
            list: "checked"
          };
          const delta = new import_quill_delta5.default().retain(range.index).insert("\n", formats).retain(line.length() - offset - 1).retain(1, {
            list: "unchecked"
          });
          this.quill.updateContents(delta, Quill.sources.USER);
          this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
          this.quill.scrollSelectionIntoView();
        }
      },
      "header enter": {
        key: "Enter",
        collapsed: true,
        format: ["header"],
        suffix: /^$/,
        handler(range, context) {
          const [line, offset] = this.quill.getLine(range.index);
          const delta = new import_quill_delta5.default().retain(range.index).insert("\n", context.format).retain(line.length() - offset - 1).retain(1, {
            header: null
          });
          this.quill.updateContents(delta, Quill.sources.USER);
          this.quill.setSelection(range.index + 1, Quill.sources.SILENT);
          this.quill.scrollSelectionIntoView();
        }
      },
      "table backspace": {
        key: "Backspace",
        format: ["table"],
        collapsed: true,
        offset: 0,
        handler() {
        }
      },
      "table delete": {
        key: "Delete",
        format: ["table"],
        collapsed: true,
        suffix: /^$/,
        handler() {
        }
      },
      "table enter": {
        key: "Enter",
        shiftKey: null,
        format: ["table"],
        handler(range) {
          const module2 = this.quill.getModule("table");
          if (module2) {
            const [table, row, cell, offset] = module2.getTable(range);
            const shift = tableSide(table, row, cell, offset);
            if (shift == null)
              return;
            let index = table.offset();
            if (shift < 0) {
              const delta = new import_quill_delta5.default().retain(index).insert("\n");
              this.quill.updateContents(delta, Quill.sources.USER);
              this.quill.setSelection(range.index + 1, range.length, Quill.sources.SILENT);
            } else if (shift > 0) {
              index += table.length();
              const delta = new import_quill_delta5.default().retain(index).insert("\n");
              this.quill.updateContents(delta, Quill.sources.USER);
              this.quill.setSelection(index, Quill.sources.USER);
            }
          }
        }
      },
      "table tab": {
        key: "Tab",
        shiftKey: null,
        format: ["table"],
        handler(range, context) {
          const {
            event,
            line: cell
          } = context;
          const offset = cell.offset(this.quill.scroll);
          if (event.shiftKey) {
            this.quill.setSelection(offset - 1, Quill.sources.USER);
          } else {
            this.quill.setSelection(offset + cell.length(), Quill.sources.USER);
          }
        }
      },
      "list autofill": {
        key: " ",
        shiftKey: null,
        collapsed: true,
        format: {
          "code-block": false,
          blockquote: false,
          table: false
        },
        prefix: /^\s*?(\d+\.|-|\*|\[ ?\]|\[x\])$/,
        handler(range, context) {
          if (this.quill.scroll.query("list") == null)
            return true;
          const {
            length
          } = context.prefix;
          const [line, offset] = this.quill.getLine(range.index);
          if (offset > length)
            return true;
          let value;
          switch (context.prefix.trim()) {
            case "[]":
            case "[ ]":
              value = "unchecked";
              break;
            case "[x]":
              value = "checked";
              break;
            case "-":
            case "*":
              value = "bullet";
              break;
            default:
              value = "ordered";
          }
          this.quill.insertText(range.index, " ", Quill.sources.USER);
          this.quill.history.cutoff();
          const delta = new import_quill_delta5.default().retain(range.index - offset).delete(length + 1).retain(line.length() - 2 - offset).retain(1, {
            list: value
          });
          this.quill.updateContents(delta, Quill.sources.USER);
          this.quill.history.cutoff();
          this.quill.setSelection(range.index - length, Quill.sources.SILENT);
          return false;
        }
      },
      "code exit": {
        key: "Enter",
        collapsed: true,
        format: ["code-block"],
        prefix: /^$/,
        suffix: /^\s*$/,
        handler(range) {
          const [line, offset] = this.quill.getLine(range.index);
          let numLines = 2;
          let cur = line;
          while (cur != null && cur.length() <= 1 && cur.formats()["code-block"]) {
            cur = cur.prev;
            numLines -= 1;
            if (numLines <= 0) {
              const delta = new import_quill_delta5.default().retain(range.index + line.length() - offset - 2).retain(1, {
                "code-block": null
              }).delete(1);
              this.quill.updateContents(delta, Quill.sources.USER);
              this.quill.setSelection(range.index - 1, Quill.sources.SILENT);
              return false;
            }
          }
          return true;
        }
      },
      "embed left": makeEmbedArrowHandler("ArrowLeft", false),
      "embed left shift": makeEmbedArrowHandler("ArrowLeft", true),
      "embed right": makeEmbedArrowHandler("ArrowRight", false),
      "embed right shift": makeEmbedArrowHandler("ArrowRight", true),
      "table down": makeTableArrowHandler(false),
      "table up": makeTableArrowHandler(true)
    }
  };
  Keyboard.DEFAULTS = defaultOptions;
  function makeCodeBlockHandler(indent) {
    return {
      key: "Tab",
      shiftKey: !indent,
      format: {
        "code-block": true
      },
      handler(range, _ref) {
        let {
          event
        } = _ref;
        const CodeBlock2 = this.quill.scroll.query("code-block");
        const {
          TAB
        } = CodeBlock2;
        if (range.length === 0 && !event.shiftKey) {
          this.quill.insertText(range.index, TAB, Quill.sources.USER);
          this.quill.setSelection(range.index + TAB.length, Quill.sources.SILENT);
          return;
        }
        const lines = range.length === 0 ? this.quill.getLines(range.index, 1) : this.quill.getLines(range);
        let {
          index,
          length
        } = range;
        lines.forEach((line, i) => {
          if (indent) {
            line.insertAt(0, TAB);
            if (i === 0) {
              index += TAB.length;
            } else {
              length += TAB.length;
            }
          } else if (line.domNode.textContent.startsWith(TAB)) {
            line.deleteAt(0, TAB.length);
            if (i === 0) {
              index -= TAB.length;
            } else {
              length -= TAB.length;
            }
          }
        });
        this.quill.update(Quill.sources.USER);
        this.quill.setSelection(index, length, Quill.sources.SILENT);
      }
    };
  }
  function makeEmbedArrowHandler(key, shiftKey) {
    const where = key === "ArrowLeft" ? "prefix" : "suffix";
    return {
      key,
      shiftKey,
      altKey: null,
      [where]: /^$/,
      handler(range) {
        let {
          index
        } = range;
        if (key === "ArrowRight") {
          index += range.length + 1;
        }
        const [leaf] = this.quill.getLeaf(index);
        if (!(leaf instanceof EmbedBlot$1))
          return true;
        if (key === "ArrowLeft") {
          if (shiftKey) {
            this.quill.setSelection(range.index - 1, range.length + 1, Quill.sources.USER);
          } else {
            this.quill.setSelection(range.index - 1, Quill.sources.USER);
          }
        } else if (shiftKey) {
          this.quill.setSelection(range.index, range.length + 1, Quill.sources.USER);
        } else {
          this.quill.setSelection(range.index + range.length + 1, Quill.sources.USER);
        }
        return false;
      }
    };
  }
  function makeFormatHandler(format) {
    return {
      key: format[0],
      shortKey: true,
      handler(range, context) {
        this.quill.format(format, !context.format[format], Quill.sources.USER);
      }
    };
  }
  function makeTableArrowHandler(up) {
    return {
      key: up ? "ArrowUp" : "ArrowDown",
      collapsed: true,
      format: ["table"],
      handler(range, context) {
        const key = up ? "prev" : "next";
        const cell = context.line;
        const targetRow = cell.parent[key];
        if (targetRow != null) {
          if (targetRow.statics.blotName === "table-row") {
            let targetCell = targetRow.children.head;
            let cur = cell;
            while (cur.prev != null) {
              cur = cur.prev;
              targetCell = targetCell.next;
            }
            const index = targetCell.offset(this.quill.scroll) + Math.min(context.offset, targetCell.length() - 1);
            this.quill.setSelection(index, 0, Quill.sources.USER);
          }
        } else {
          const targetLine = cell.table()[key];
          if (targetLine != null) {
            if (up) {
              this.quill.setSelection(targetLine.offset(this.quill.scroll) + targetLine.length() - 1, 0, Quill.sources.USER);
            } else {
              this.quill.setSelection(targetLine.offset(this.quill.scroll), 0, Quill.sources.USER);
            }
          }
        }
        return false;
      }
    };
  }
  function normalize(binding) {
    if (typeof binding === "string" || typeof binding === "number") {
      binding = {
        key: binding
      };
    } else if (typeof binding === "object") {
      binding = cloneDeep_default(binding);
    } else {
      return null;
    }
    if (binding.shortKey) {
      binding[SHORTKEY] = binding.shortKey;
      delete binding.shortKey;
    }
    return binding;
  }
  function deleteRange(_ref2) {
    let {
      quill,
      range
    } = _ref2;
    const lines = quill.getLines(range);
    let formats = {};
    if (lines.length > 1) {
      const firstFormats = lines[0].formats();
      const lastFormats = lines[lines.length - 1].formats();
      formats = import_quill_delta5.AttributeMap.diff(lastFormats, firstFormats) || {};
    }
    quill.deleteText(range, Quill.sources.USER);
    if (Object.keys(formats).length > 0) {
      quill.formatLine(range.index, 1, formats, Quill.sources.USER);
    }
    quill.setSelection(range.index, Quill.sources.SILENT);
  }
  function tableSide(_table, row, cell, offset) {
    if (row.prev == null && row.next == null) {
      if (cell.prev == null && cell.next == null) {
        return offset === 0 ? -1 : 1;
      }
      return cell.prev == null ? -1 : 1;
    }
    if (row.prev == null) {
      return -1;
    }
    if (row.next == null) {
      return 1;
    }
    return null;
  }

  // node_modules/quill/modules/normalizeExternalHTML/normalizers/googleDocs.js
  var normalWeightRegexp = /font-weight:\s*normal/;
  var blockTagNames = ["P", "OL", "UL"];
  var isBlockElement = (element) => {
    return element && blockTagNames.includes(element.tagName);
  };
  var normalizeEmptyLines = (doc) => {
    Array.from(doc.querySelectorAll("br")).filter((br) => isBlockElement(br.previousElementSibling) && isBlockElement(br.nextElementSibling)).forEach((br) => {
      br.parentNode?.removeChild(br);
    });
  };
  var normalizeFontWeight = (doc) => {
    Array.from(doc.querySelectorAll('b[style*="font-weight"]')).filter((node) => node.getAttribute("style")?.match(normalWeightRegexp)).forEach((node) => {
      const fragment = doc.createDocumentFragment();
      fragment.append(...node.childNodes);
      node.parentNode?.replaceChild(fragment, node);
    });
  };
  function normalize2(doc) {
    if (doc.querySelector('[id^="docs-internal-guid-"]')) {
      normalizeFontWeight(doc);
      normalizeEmptyLines(doc);
    }
  }

  // node_modules/quill/modules/normalizeExternalHTML/normalizers/msWord.js
  var ignoreRegexp = /\bmso-list:[^;]*ignore/i;
  var idRegexp = /\bmso-list:[^;]*\bl(\d+)/i;
  var indentRegexp = /\bmso-list:[^;]*\blevel(\d+)/i;
  var parseListItem = (element, html) => {
    const style = element.getAttribute("style");
    const idMatch = style?.match(idRegexp);
    if (!idMatch) {
      return null;
    }
    const id = Number(idMatch[1]);
    const indentMatch = style?.match(indentRegexp);
    const indent = indentMatch ? Number(indentMatch[1]) : 1;
    const typeRegexp = new RegExp(`@list l${id}:level${indent}\\s*\\{[^\\}]*mso-level-number-format:\\s*([\\w-]+)`, "i");
    const typeMatch = html.match(typeRegexp);
    const type = typeMatch && typeMatch[1] === "bullet" ? "bullet" : "ordered";
    return {
      id,
      indent,
      type,
      element
    };
  };
  var normalizeListItem = (doc) => {
    const msoList = Array.from(doc.querySelectorAll("[style*=mso-list]"));
    const ignored = [];
    const others = [];
    msoList.forEach((node) => {
      const shouldIgnore = (node.getAttribute("style") || "").match(ignoreRegexp);
      if (shouldIgnore) {
        ignored.push(node);
      } else {
        others.push(node);
      }
    });
    ignored.forEach((node) => node.parentNode?.removeChild(node));
    const html = doc.documentElement.innerHTML;
    const listItems = others.map((element) => parseListItem(element, html)).filter((parsed) => parsed);
    while (listItems.length) {
      const childListItems = [];
      let current = listItems.shift();
      while (current) {
        childListItems.push(current);
        current = listItems.length && listItems[0]?.element === current.element.nextElementSibling && // Different id means the next item doesn't belong to this group.
        listItems[0].id === current.id ? listItems.shift() : null;
      }
      const ul = document.createElement("ul");
      childListItems.forEach((listItem) => {
        const li = document.createElement("li");
        li.setAttribute("data-list", listItem.type);
        if (listItem.indent > 1) {
          li.setAttribute("class", `ql-indent-${listItem.indent - 1}`);
        }
        li.innerHTML = listItem.element.innerHTML;
        ul.appendChild(li);
      });
      const element = childListItems[0]?.element;
      const {
        parentNode
      } = element ?? {};
      if (element) {
        parentNode?.replaceChild(ul, element);
      }
      childListItems.slice(1).forEach((_ref) => {
        let {
          element: e
        } = _ref;
        parentNode?.removeChild(e);
      });
    }
  };
  function normalize3(doc) {
    if (doc.documentElement.getAttribute("xmlns:w") === "urn:schemas-microsoft-com:office:word") {
      normalizeListItem(doc);
    }
  }

  // node_modules/quill/modules/normalizeExternalHTML/index.js
  var NORMALIZERS = [normalize3, normalize2];
  var normalizeExternalHTML = (doc) => {
    if (doc.documentElement) {
      NORMALIZERS.forEach((normalize4) => {
        normalize4(doc);
      });
    }
  };
  var normalizeExternalHTML_default = normalizeExternalHTML;

  // node_modules/quill/modules/clipboard.js
  var debug7 = logger_default("quill:clipboard");
  var CLIPBOARD_CONFIG = [[Node.TEXT_NODE, matchText], [Node.TEXT_NODE, matchNewline], ["br", matchBreak], [Node.ELEMENT_NODE, matchNewline], [Node.ELEMENT_NODE, matchBlot], [Node.ELEMENT_NODE, matchAttributor], [Node.ELEMENT_NODE, matchStyles], ["li", matchIndent], ["ol, ul", matchList], ["pre", matchCodeBlock], ["tr", matchTable], ["b", createMatchAlias("bold")], ["i", createMatchAlias("italic")], ["strike", createMatchAlias("strike")], ["style", matchIgnore]];
  var ATTRIBUTE_ATTRIBUTORS = [AlignAttribute, DirectionAttribute].reduce((memo, attr) => {
    memo[attr.keyName] = attr;
    return memo;
  }, {});
  var STYLE_ATTRIBUTORS = [AlignStyle, BackgroundStyle, ColorStyle, DirectionStyle, FontStyle, SizeStyle].reduce((memo, attr) => {
    memo[attr.keyName] = attr;
    return memo;
  }, {});
  var Clipboard = class extends module_default {
    static DEFAULTS = {
      matchers: []
    };
    constructor(quill, options) {
      super(quill, options);
      this.quill.root.addEventListener("copy", (e) => this.onCaptureCopy(e, false));
      this.quill.root.addEventListener("cut", (e) => this.onCaptureCopy(e, true));
      this.quill.root.addEventListener("paste", this.onCapturePaste.bind(this));
      this.matchers = [];
      CLIPBOARD_CONFIG.concat(this.options.matchers ?? []).forEach((_ref) => {
        let [selector, matcher] = _ref;
        this.addMatcher(selector, matcher);
      });
    }
    addMatcher(selector, matcher) {
      this.matchers.push([selector, matcher]);
    }
    convert(_ref2) {
      let {
        html,
        text
      } = _ref2;
      let formats = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      if (formats[CodeBlock.blotName]) {
        return new import_quill_delta6.default().insert(text || "", {
          [CodeBlock.blotName]: formats[CodeBlock.blotName]
        });
      }
      if (!html) {
        return new import_quill_delta6.default().insert(text || "", formats);
      }
      const delta = this.convertHTML(html);
      if (deltaEndsWith(delta, "\n") && (delta.ops[delta.ops.length - 1].attributes == null || formats.table)) {
        return delta.compose(new import_quill_delta6.default().retain(delta.length() - 1).delete(1));
      }
      return delta;
    }
    normalizeHTML(doc) {
      normalizeExternalHTML_default(doc);
    }
    convertHTML(html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      this.normalizeHTML(doc);
      const container = doc.body;
      const nodeMatches = /* @__PURE__ */ new WeakMap();
      const [elementMatchers, textMatchers] = this.prepareMatching(container, nodeMatches);
      return traverse(this.quill.scroll, container, elementMatchers, textMatchers, nodeMatches);
    }
    dangerouslyPasteHTML(index, html) {
      let source = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : Quill.sources.API;
      if (typeof index === "string") {
        const delta = this.convert({
          html: index,
          text: ""
        });
        this.quill.setContents(delta, html);
        this.quill.setSelection(0, Quill.sources.SILENT);
      } else {
        const paste = this.convert({
          html,
          text: ""
        });
        this.quill.updateContents(new import_quill_delta6.default().retain(index).concat(paste), source);
        this.quill.setSelection(index + paste.length(), Quill.sources.SILENT);
      }
    }
    onCaptureCopy(e) {
      let isCut = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      if (e.defaultPrevented)
        return;
      e.preventDefault();
      const [range] = this.quill.selection.getRange();
      if (range == null)
        return;
      const {
        html,
        text
      } = this.onCopy(range, isCut);
      e.clipboardData?.setData("text/plain", text);
      e.clipboardData?.setData("text/html", html);
      if (isCut) {
        deleteRange({
          range,
          quill: this.quill
        });
      }
    }
    /*
     * https://www.iana.org/assignments/media-types/text/uri-list
     */
    normalizeURIList(urlList) {
      return urlList.split(/\r?\n/).filter((url) => url[0] !== "#").join("\n");
    }
    onCapturePaste(e) {
      if (e.defaultPrevented || !this.quill.isEnabled())
        return;
      e.preventDefault();
      const range = this.quill.getSelection(true);
      if (range == null)
        return;
      const html = e.clipboardData?.getData("text/html");
      let text = e.clipboardData?.getData("text/plain");
      if (!html && !text) {
        const urlList = e.clipboardData?.getData("text/uri-list");
        if (urlList) {
          text = this.normalizeURIList(urlList);
        }
      }
      const files = Array.from(e.clipboardData?.files || []);
      if (!html && files.length > 0) {
        this.quill.uploader.upload(range, files);
        return;
      }
      if (html && files.length > 0) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (doc.body.childElementCount === 1 && doc.body.firstElementChild?.tagName === "IMG") {
          this.quill.uploader.upload(range, files);
          return;
        }
      }
      this.onPaste(range, {
        html,
        text
      });
    }
    onCopy(range) {
      const text = this.quill.getText(range);
      const html = this.quill.getSemanticHTML(range);
      return {
        html,
        text
      };
    }
    onPaste(range, _ref3) {
      let {
        text,
        html
      } = _ref3;
      const formats = this.quill.getFormat(range.index);
      const pastedDelta = this.convert({
        text,
        html
      }, formats);
      debug7.log("onPaste", pastedDelta, {
        text,
        html
      });
      const delta = new import_quill_delta6.default().retain(range.index).delete(range.length).concat(pastedDelta);
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.setSelection(delta.length() - range.length, Quill.sources.SILENT);
      this.quill.scrollSelectionIntoView();
    }
    prepareMatching(container, nodeMatches) {
      const elementMatchers = [];
      const textMatchers = [];
      this.matchers.forEach((pair) => {
        const [selector, matcher] = pair;
        switch (selector) {
          case Node.TEXT_NODE:
            textMatchers.push(matcher);
            break;
          case Node.ELEMENT_NODE:
            elementMatchers.push(matcher);
            break;
          default:
            Array.from(container.querySelectorAll(selector)).forEach((node) => {
              if (nodeMatches.has(node)) {
                const matches = nodeMatches.get(node);
                matches?.push(matcher);
              } else {
                nodeMatches.set(node, [matcher]);
              }
            });
            break;
        }
      });
      return [elementMatchers, textMatchers];
    }
  };
  function applyFormat(delta, format, value, scroll) {
    if (!scroll.query(format)) {
      return delta;
    }
    return delta.reduce((newDelta, op) => {
      if (!op.insert)
        return newDelta;
      if (op.attributes && op.attributes[format]) {
        return newDelta.push(op);
      }
      const formats = value ? {
        [format]: value
      } : {};
      return newDelta.insert(op.insert, {
        ...formats,
        ...op.attributes
      });
    }, new import_quill_delta6.default());
  }
  function deltaEndsWith(delta, text) {
    let endText = "";
    for (let i = delta.ops.length - 1; i >= 0 && endText.length < text.length; --i) {
      const op = delta.ops[i];
      if (typeof op.insert !== "string")
        break;
      endText = op.insert + endText;
    }
    return endText.slice(-1 * text.length) === text;
  }
  function isLine2(node, scroll) {
    if (!(node instanceof Element))
      return false;
    const match2 = scroll.query(node);
    if (match2 && match2.prototype instanceof EmbedBlot$1)
      return false;
    return ["address", "article", "blockquote", "canvas", "dd", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "iframe", "li", "main", "nav", "ol", "output", "p", "pre", "section", "table", "td", "tr", "ul", "video"].includes(node.tagName.toLowerCase());
  }
  function isBetweenInlineElements(node, scroll) {
    return node.previousElementSibling && node.nextElementSibling && !isLine2(node.previousElementSibling, scroll) && !isLine2(node.nextElementSibling, scroll);
  }
  var preNodes = /* @__PURE__ */ new WeakMap();
  function isPre(node) {
    if (node == null)
      return false;
    if (!preNodes.has(node)) {
      if (node.tagName === "PRE") {
        preNodes.set(node, true);
      } else {
        preNodes.set(node, isPre(node.parentNode));
      }
    }
    return preNodes.get(node);
  }
  function traverse(scroll, node, elementMatchers, textMatchers, nodeMatches) {
    if (node.nodeType === node.TEXT_NODE) {
      return textMatchers.reduce((delta, matcher) => {
        return matcher(node, delta, scroll);
      }, new import_quill_delta6.default());
    }
    if (node.nodeType === node.ELEMENT_NODE) {
      return Array.from(node.childNodes || []).reduce((delta, childNode) => {
        let childrenDelta = traverse(scroll, childNode, elementMatchers, textMatchers, nodeMatches);
        if (childNode.nodeType === node.ELEMENT_NODE) {
          childrenDelta = elementMatchers.reduce((reducedDelta, matcher) => {
            return matcher(childNode, reducedDelta, scroll);
          }, childrenDelta);
          childrenDelta = (nodeMatches.get(childNode) || []).reduce((reducedDelta, matcher) => {
            return matcher(childNode, reducedDelta, scroll);
          }, childrenDelta);
        }
        return delta.concat(childrenDelta);
      }, new import_quill_delta6.default());
    }
    return new import_quill_delta6.default();
  }
  function createMatchAlias(format) {
    return (_node, delta, scroll) => {
      return applyFormat(delta, format, true, scroll);
    };
  }
  function matchAttributor(node, delta, scroll) {
    const attributes = Attributor.keys(node);
    const classes = ClassAttributor$1.keys(node);
    const styles = StyleAttributor$1.keys(node);
    const formats = {};
    attributes.concat(classes).concat(styles).forEach((name) => {
      let attr = scroll.query(name, Scope.ATTRIBUTE);
      if (attr != null) {
        formats[attr.attrName] = attr.value(node);
        if (formats[attr.attrName])
          return;
      }
      attr = ATTRIBUTE_ATTRIBUTORS[name];
      if (attr != null && (attr.attrName === name || attr.keyName === name)) {
        formats[attr.attrName] = attr.value(node) || void 0;
      }
      attr = STYLE_ATTRIBUTORS[name];
      if (attr != null && (attr.attrName === name || attr.keyName === name)) {
        attr = STYLE_ATTRIBUTORS[name];
        formats[attr.attrName] = attr.value(node) || void 0;
      }
    });
    return Object.entries(formats).reduce((newDelta, _ref4) => {
      let [name, value] = _ref4;
      return applyFormat(newDelta, name, value, scroll);
    }, delta);
  }
  function matchBlot(node, delta, scroll) {
    const match2 = scroll.query(node);
    if (match2 == null)
      return delta;
    if (match2.prototype instanceof EmbedBlot$1) {
      const embed = {};
      const value = match2.value(node);
      if (value != null) {
        embed[match2.blotName] = value;
        return new import_quill_delta6.default().insert(embed, match2.formats(node, scroll));
      }
    } else {
      if (match2.prototype instanceof BlockBlot$1 && !deltaEndsWith(delta, "\n")) {
        delta.insert("\n");
      }
      if ("blotName" in match2 && "formats" in match2 && typeof match2.formats === "function") {
        return applyFormat(delta, match2.blotName, match2.formats(node, scroll), scroll);
      }
    }
    return delta;
  }
  function matchBreak(node, delta) {
    if (!deltaEndsWith(delta, "\n")) {
      delta.insert("\n");
    }
    return delta;
  }
  function matchCodeBlock(node, delta, scroll) {
    const match2 = scroll.query("code-block");
    const language = match2 && "formats" in match2 && typeof match2.formats === "function" ? match2.formats(node, scroll) : true;
    return applyFormat(delta, "code-block", language, scroll);
  }
  function matchIgnore() {
    return new import_quill_delta6.default();
  }
  function matchIndent(node, delta, scroll) {
    const match2 = scroll.query(node);
    if (match2 == null || // @ts-expect-error
    match2.blotName !== "list" || !deltaEndsWith(delta, "\n")) {
      return delta;
    }
    let indent = -1;
    let parent = node.parentNode;
    while (parent != null) {
      if (["OL", "UL"].includes(parent.tagName)) {
        indent += 1;
      }
      parent = parent.parentNode;
    }
    if (indent <= 0)
      return delta;
    return delta.reduce((composed, op) => {
      if (!op.insert)
        return composed;
      if (op.attributes && typeof op.attributes.indent === "number") {
        return composed.push(op);
      }
      return composed.insert(op.insert, {
        indent,
        ...op.attributes || {}
      });
    }, new import_quill_delta6.default());
  }
  function matchList(node, delta, scroll) {
    const element = node;
    let list = element.tagName === "OL" ? "ordered" : "bullet";
    const checkedAttr = element.getAttribute("data-checked");
    if (checkedAttr) {
      list = checkedAttr === "true" ? "checked" : "unchecked";
    }
    return applyFormat(delta, "list", list, scroll);
  }
  function matchNewline(node, delta, scroll) {
    if (!deltaEndsWith(delta, "\n")) {
      if (isLine2(node, scroll) && (node.childNodes.length > 0 || node instanceof HTMLParagraphElement)) {
        return delta.insert("\n");
      }
      if (delta.length() > 0 && node.nextSibling) {
        let nextSibling = node.nextSibling;
        while (nextSibling != null) {
          if (isLine2(nextSibling, scroll)) {
            return delta.insert("\n");
          }
          const match2 = scroll.query(nextSibling);
          if (match2 && match2.prototype instanceof BlockEmbed) {
            return delta.insert("\n");
          }
          nextSibling = nextSibling.firstChild;
        }
      }
    }
    return delta;
  }
  function matchStyles(node, delta, scroll) {
    const formats = {};
    const style = node.style || {};
    if (style.fontStyle === "italic") {
      formats.italic = true;
    }
    if (style.textDecoration === "underline") {
      formats.underline = true;
    }
    if (style.textDecoration === "line-through") {
      formats.strike = true;
    }
    if (style.fontWeight?.startsWith("bold") || // @ts-expect-error Fix me later
    parseInt(style.fontWeight, 10) >= 700) {
      formats.bold = true;
    }
    delta = Object.entries(formats).reduce((newDelta, _ref5) => {
      let [name, value] = _ref5;
      return applyFormat(newDelta, name, value, scroll);
    }, delta);
    if (parseFloat(style.textIndent || 0) > 0) {
      return new import_quill_delta6.default().insert("	").concat(delta);
    }
    return delta;
  }
  function matchTable(node, delta, scroll) {
    const table = node.parentElement?.tagName === "TABLE" ? node.parentElement : node.parentElement?.parentElement;
    if (table != null) {
      const rows = Array.from(table.querySelectorAll("tr"));
      const row = rows.indexOf(node) + 1;
      return applyFormat(delta, "table", row, scroll);
    }
    return delta;
  }
  function matchText(node, delta, scroll) {
    let text = node.data;
    if (node.parentElement?.tagName === "O:P") {
      return delta.insert(text.trim());
    }
    if (!isPre(node)) {
      if (text.trim().length === 0 && text.includes("\n") && !isBetweenInlineElements(node, scroll)) {
        return delta;
      }
      const replacer = (collapse, match2) => {
        const replaced = match2.replace(/[^\u00a0]/g, "");
        return replaced.length < 1 && collapse ? " " : replaced;
      };
      text = text.replace(/\r\n/g, " ").replace(/\n/g, " ");
      text = text.replace(/\s\s+/g, replacer.bind(replacer, true));
      if (node.previousSibling == null && node.parentElement != null && isLine2(node.parentElement, scroll) || node.previousSibling instanceof Element && isLine2(node.previousSibling, scroll)) {
        text = text.replace(/^\s+/, replacer.bind(replacer, false));
      }
      if (node.nextSibling == null && node.parentElement != null && isLine2(node.parentElement, scroll) || node.nextSibling instanceof Element && isLine2(node.nextSibling, scroll)) {
        text = text.replace(/\s+$/, replacer.bind(replacer, false));
      }
    }
    return delta.insert(text);
  }

  // node_modules/quill/modules/history.js
  var History = class extends module_default {
    static DEFAULTS = {
      delay: 1e3,
      maxStack: 100,
      userOnly: false
    };
    lastRecorded = 0;
    ignoreChange = false;
    stack = {
      undo: [],
      redo: []
    };
    currentRange = null;
    constructor(quill, options) {
      super(quill, options);
      this.quill.on(Quill.events.EDITOR_CHANGE, (eventName, value, oldValue, source) => {
        if (eventName === Quill.events.SELECTION_CHANGE) {
          if (value && source !== Quill.sources.SILENT) {
            this.currentRange = value;
          }
        } else if (eventName === Quill.events.TEXT_CHANGE) {
          if (!this.ignoreChange) {
            if (!this.options.userOnly || source === Quill.sources.USER) {
              this.record(value, oldValue);
            } else {
              this.transform(value);
            }
          }
          this.currentRange = transformRange(this.currentRange, value);
        }
      });
      this.quill.keyboard.addBinding({
        key: "z",
        shortKey: true
      }, this.undo.bind(this));
      this.quill.keyboard.addBinding({
        key: ["z", "Z"],
        shortKey: true,
        shiftKey: true
      }, this.redo.bind(this));
      if (/Win/i.test(navigator.platform)) {
        this.quill.keyboard.addBinding({
          key: "y",
          shortKey: true
        }, this.redo.bind(this));
      }
      this.quill.root.addEventListener("beforeinput", (event) => {
        if (event.inputType === "historyUndo") {
          this.undo();
          event.preventDefault();
        } else if (event.inputType === "historyRedo") {
          this.redo();
          event.preventDefault();
        }
      });
    }
    change(source, dest) {
      if (this.stack[source].length === 0)
        return;
      const item = this.stack[source].pop();
      if (!item)
        return;
      const base = this.quill.getContents();
      const inverseDelta = item.delta.invert(base);
      this.stack[dest].push({
        delta: inverseDelta,
        range: transformRange(item.range, inverseDelta)
      });
      this.lastRecorded = 0;
      this.ignoreChange = true;
      this.quill.updateContents(item.delta, Quill.sources.USER);
      this.ignoreChange = false;
      this.restoreSelection(item);
    }
    clear() {
      this.stack = {
        undo: [],
        redo: []
      };
    }
    cutoff() {
      this.lastRecorded = 0;
    }
    record(changeDelta, oldDelta) {
      if (changeDelta.ops.length === 0)
        return;
      this.stack.redo = [];
      let undoDelta = changeDelta.invert(oldDelta);
      let undoRange = this.currentRange;
      const timestamp = Date.now();
      if (
        // @ts-expect-error Fix me later
        this.lastRecorded + this.options.delay > timestamp && this.stack.undo.length > 0
      ) {
        const item = this.stack.undo.pop();
        if (item) {
          undoDelta = undoDelta.compose(item.delta);
          undoRange = item.range;
        }
      } else {
        this.lastRecorded = timestamp;
      }
      if (undoDelta.length() === 0)
        return;
      this.stack.undo.push({
        delta: undoDelta,
        range: undoRange
      });
      if (this.stack.undo.length > this.options.maxStack) {
        this.stack.undo.shift();
      }
    }
    redo() {
      this.change("redo", "undo");
    }
    transform(delta) {
      transformStack(this.stack.undo, delta);
      transformStack(this.stack.redo, delta);
    }
    undo() {
      this.change("undo", "redo");
    }
    restoreSelection(stackItem) {
      if (stackItem.range) {
        this.quill.setSelection(stackItem.range, Quill.sources.USER);
      } else {
        const index = getLastChangeIndex(this.quill.scroll, stackItem.delta);
        this.quill.setSelection(index, Quill.sources.USER);
      }
    }
  };
  function transformStack(stack, delta) {
    let remoteDelta = delta;
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const oldItem = stack[i];
      stack[i] = {
        delta: remoteDelta.transform(oldItem.delta, true),
        range: oldItem.range && transformRange(oldItem.range, remoteDelta)
      };
      remoteDelta = oldItem.delta.transform(remoteDelta);
      if (stack[i].delta.length() === 0) {
        stack.splice(i, 1);
      }
    }
  }
  function endsWithNewlineChange(scroll, delta) {
    const lastOp = delta.ops[delta.ops.length - 1];
    if (lastOp == null)
      return false;
    if (lastOp.insert != null) {
      return typeof lastOp.insert === "string" && lastOp.insert.endsWith("\n");
    }
    if (lastOp.attributes != null) {
      return Object.keys(lastOp.attributes).some((attr) => {
        return scroll.query(attr, Scope.BLOCK) != null;
      });
    }
    return false;
  }
  function getLastChangeIndex(scroll, delta) {
    const deleteLength = delta.reduce((length, op) => {
      return length + (op.delete || 0);
    }, 0);
    let changeIndex = delta.length() - deleteLength;
    if (endsWithNewlineChange(scroll, delta)) {
      changeIndex -= 1;
    }
    return changeIndex;
  }
  function transformRange(range, delta) {
    if (!range)
      return range;
    const start = delta.transformPosition(range.index);
    const end = delta.transformPosition(range.index + range.length);
    return {
      index: start,
      length: end - start
    };
  }

  // node_modules/quill/modules/uploader.js
  var import_quill_delta7 = __toESM(require_Delta(), 1);
  var Uploader = class extends module_default {
    constructor(quill, options) {
      super(quill, options);
      quill.root.addEventListener("drop", (e) => {
        e.preventDefault();
        let native = null;
        if (document.caretRangeFromPoint) {
          native = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
          const position = document.caretPositionFromPoint(e.clientX, e.clientY);
          native = document.createRange();
          native.setStart(position.offsetNode, position.offset);
          native.setEnd(position.offsetNode, position.offset);
        }
        const normalized = native && quill.selection.normalizeNative(native);
        if (normalized) {
          const range = quill.selection.normalizedToRange(normalized);
          if (e.dataTransfer?.files) {
            this.upload(range, e.dataTransfer.files);
          }
        }
      });
    }
    upload(range, files) {
      const uploads = [];
      Array.from(files).forEach((file) => {
        if (file && this.options.mimetypes?.includes(file.type)) {
          uploads.push(file);
        }
      });
      if (uploads.length > 0) {
        this.options.handler.call(this, range, uploads);
      }
    }
  };
  Uploader.DEFAULTS = {
    mimetypes: ["image/png", "image/jpeg"],
    handler(range, files) {
      if (!this.quill.scroll.query("image")) {
        return;
      }
      const promises = files.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(reader.result);
          };
          reader.readAsDataURL(file);
        });
      });
      Promise.all(promises).then((images) => {
        const update = images.reduce((delta, image) => {
          return delta.insert({
            image
          });
        }, new import_quill_delta7.default().retain(range.index).delete(range.length));
        this.quill.updateContents(update, emitter_default.sources.USER);
        this.quill.setSelection(range.index + images.length, emitter_default.sources.SILENT);
      });
    }
  };
  var uploader_default = Uploader;

  // node_modules/quill/core.js
  var import_quill_delta9 = __toESM(require_Delta(), 1);

  // node_modules/quill/modules/input.js
  var import_quill_delta8 = __toESM(require_Delta(), 1);
  var INSERT_TYPES = ["insertText", "insertReplacementText"];
  var Input = class extends module_default {
    constructor(quill, options) {
      super(quill, options);
      quill.root.addEventListener("beforeinput", (event) => {
        this.handleBeforeInput(event);
      });
      if (!/Android/i.test(navigator.userAgent)) {
        quill.on(Quill.events.COMPOSITION_BEFORE_START, () => {
          this.handleCompositionStart();
        });
      }
    }
    deleteRange(range) {
      deleteRange({
        range,
        quill: this.quill
      });
    }
    replaceText(range) {
      let text = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "";
      if (range.length === 0)
        return false;
      if (text) {
        const formats = this.quill.getFormat(range.index, 1);
        this.deleteRange(range);
        this.quill.updateContents(new import_quill_delta8.default().retain(range.index).insert(text, formats), Quill.sources.USER);
      } else {
        this.deleteRange(range);
      }
      this.quill.setSelection(range.index + text.length, 0, Quill.sources.SILENT);
      return true;
    }
    handleBeforeInput(event) {
      if (this.quill.composition.isComposing || event.defaultPrevented || !INSERT_TYPES.includes(event.inputType)) {
        return;
      }
      const staticRange = event.getTargetRanges ? event.getTargetRanges()[0] : null;
      if (!staticRange || staticRange.collapsed === true) {
        return;
      }
      const text = getPlainTextFromInputEvent(event);
      if (text == null) {
        return;
      }
      const normalized = this.quill.selection.normalizeNative(staticRange);
      const range = normalized ? this.quill.selection.normalizedToRange(normalized) : null;
      if (range && this.replaceText(range, text)) {
        event.preventDefault();
      }
    }
    handleCompositionStart() {
      const range = this.quill.getSelection();
      if (range) {
        this.replaceText(range);
      }
    }
  };
  function getPlainTextFromInputEvent(event) {
    if (typeof event.data === "string") {
      return event.data;
    }
    if (event.dataTransfer?.types.includes("text/plain")) {
      return event.dataTransfer.getData("text/plain");
    }
    return null;
  }
  var input_default = Input;

  // node_modules/quill/modules/uiNode.js
  var isMac = /Mac/i.test(navigator.platform);
  var TTL_FOR_VALID_SELECTION_CHANGE = 100;
  var canMoveCaretBeforeUINode = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || // RTL scripts or moving from the end of the previous line
    event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Home") {
      return true;
    }
    if (isMac && event.key === "a" && event.ctrlKey === true) {
      return true;
    }
    return false;
  };
  var UINode = class extends module_default {
    isListening = false;
    selectionChangeDeadline = 0;
    constructor(quill, options) {
      super(quill, options);
      this.handleArrowKeys();
      this.handleNavigationShortcuts();
    }
    handleArrowKeys() {
      this.quill.keyboard.addBinding({
        key: ["ArrowLeft", "ArrowRight"],
        offset: 0,
        shiftKey: null,
        handler(range, _ref) {
          let {
            line,
            event
          } = _ref;
          if (!(line instanceof ParentBlot$1) || !line.uiNode) {
            return true;
          }
          const isRTL = getComputedStyle(line.domNode)["direction"] === "rtl";
          if (isRTL && event.key !== "ArrowRight" || !isRTL && event.key !== "ArrowLeft") {
            return true;
          }
          this.quill.setSelection(range.index - 1, range.length + (event.shiftKey ? 1 : 0), Quill.sources.USER);
          return false;
        }
      });
    }
    handleNavigationShortcuts() {
      this.quill.root.addEventListener("keydown", (event) => {
        if (!event.defaultPrevented && canMoveCaretBeforeUINode(event)) {
          this.ensureListeningToSelectionChange();
        }
      });
    }
    /**
     * We only listen to the `selectionchange` event when
     * there is an intention of moving the caret to the beginning using shortcuts.
     * This is primarily implemented to prevent infinite loops, as we are changing
     * the selection within the handler of a `selectionchange` event.
     */
    ensureListeningToSelectionChange() {
      this.selectionChangeDeadline = Date.now() + TTL_FOR_VALID_SELECTION_CHANGE;
      if (this.isListening)
        return;
      this.isListening = true;
      const listener = () => {
        this.isListening = false;
        if (Date.now() <= this.selectionChangeDeadline) {
          this.handleSelectionChange();
        }
      };
      document.addEventListener("selectionchange", listener, {
        once: true
      });
    }
    handleSelectionChange() {
      const selection = document.getSelection();
      if (!selection)
        return;
      const range = selection.getRangeAt(0);
      if (range.collapsed !== true || range.startOffset !== 0)
        return;
      const line = this.quill.scroll.find(range.startContainer);
      if (!(line instanceof ParentBlot$1) || !line.uiNode)
        return;
      const newRange = document.createRange();
      newRange.setStartAfter(line.uiNode);
      newRange.setEndAfter(line.uiNode);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  };
  var uiNode_default = UINode;

  // node_modules/quill/core.js
  Quill.register({
    "blots/block": Block,
    "blots/block/embed": BlockEmbed,
    "blots/break": break_default,
    "blots/container": container_default,
    "blots/cursor": cursor_default,
    "blots/embed": embed_default,
    "blots/inline": inline_default,
    "blots/scroll": scroll_default,
    "blots/text": Text2,
    "modules/clipboard": Clipboard,
    "modules/history": History,
    "modules/keyboard": Keyboard,
    "modules/uploader": uploader_default,
    "modules/input": input_default,
    "modules/uiNode": uiNode_default
  });
  var core_default = Quill;

  // node_modules/quill/formats/indent.js
  var IndentAttributor = class extends ClassAttributor$1 {
    add(node, value) {
      let normalizedValue = 0;
      if (value === "+1" || value === "-1") {
        const indent = this.value(node) || 0;
        normalizedValue = value === "+1" ? indent + 1 : indent - 1;
      } else if (typeof value === "number") {
        normalizedValue = value;
      }
      if (normalizedValue === 0) {
        this.remove(node);
        return true;
      }
      return super.add(node, normalizedValue.toString());
    }
    canAdd(node, value) {
      return super.canAdd(node, value) || super.canAdd(node, parseInt(value, 10));
    }
    value(node) {
      return parseInt(super.value(node), 10) || void 0;
    }
  };
  var IndentClass = new IndentAttributor("indent", "ql-indent", {
    scope: Scope.BLOCK,
    // @ts-expect-error
    whitelist: [1, 2, 3, 4, 5, 6, 7, 8]
  });
  var indent_default = IndentClass;

  // node_modules/quill/formats/blockquote.js
  var Blockquote = class extends Block {
    static blotName = "blockquote";
    static tagName = "blockquote";
  };
  var blockquote_default = Blockquote;

  // node_modules/quill/formats/header.js
  var Header = class extends Block {
    static blotName = "header";
    static tagName = ["H1", "H2", "H3", "H4", "H5", "H6"];
    static formats(domNode) {
      return this.tagName.indexOf(domNode.tagName) + 1;
    }
  };
  var header_default = Header;

  // node_modules/quill/formats/list.js
  var ListContainer = class extends container_default {
  };
  ListContainer.blotName = "list-container";
  ListContainer.tagName = "OL";
  var ListItem = class extends Block {
    static create(value) {
      const node = super.create();
      node.setAttribute("data-list", value);
      return node;
    }
    static formats(domNode) {
      return domNode.getAttribute("data-list") || void 0;
    }
    static register() {
      Quill.register(ListContainer);
    }
    constructor(scroll, domNode) {
      super(scroll, domNode);
      const ui = domNode.ownerDocument.createElement("span");
      const listEventHandler = (e) => {
        if (!scroll.isEnabled())
          return;
        const format = this.statics.formats(domNode, scroll);
        if (format === "checked") {
          this.format("list", "unchecked");
          e.preventDefault();
        } else if (format === "unchecked") {
          this.format("list", "checked");
          e.preventDefault();
        }
      };
      ui.addEventListener("mousedown", listEventHandler);
      ui.addEventListener("touchstart", listEventHandler);
      this.attachUI(ui);
    }
    format(name, value) {
      if (name === this.statics.blotName && value) {
        this.domNode.setAttribute("data-list", value);
      } else {
        super.format(name, value);
      }
    }
  };
  ListItem.blotName = "list";
  ListItem.tagName = "LI";
  ListContainer.allowedChildren = [ListItem];
  ListItem.requiredContainer = ListContainer;

  // node_modules/quill/formats/bold.js
  var Bold = class extends inline_default {
    static blotName = "bold";
    static tagName = ["STRONG", "B"];
    static create() {
      return super.create();
    }
    static formats() {
      return true;
    }
    optimize(context) {
      super.optimize(context);
      if (this.domNode.tagName !== this.statics.tagName[0]) {
        this.replaceWith(this.statics.blotName);
      }
    }
  };
  var bold_default = Bold;

  // node_modules/quill/formats/italic.js
  var Italic = class extends bold_default {
    static blotName = "italic";
    static tagName = ["EM", "I"];
  };
  var italic_default = Italic;

  // node_modules/quill/formats/link.js
  var Link = class extends inline_default {
    static blotName = "link";
    static tagName = "A";
    static SANITIZED_URL = "about:blank";
    static PROTOCOL_WHITELIST = ["http", "https", "mailto", "tel", "sms"];
    static create(value) {
      const node = super.create(value);
      node.setAttribute("href", this.sanitize(value));
      node.setAttribute("rel", "noopener noreferrer");
      node.setAttribute("target", "_blank");
      return node;
    }
    static formats(domNode) {
      return domNode.getAttribute("href");
    }
    static sanitize(url) {
      return sanitize(url, this.PROTOCOL_WHITELIST) ? url : this.SANITIZED_URL;
    }
    format(name, value) {
      if (name !== this.statics.blotName || !value) {
        super.format(name, value);
      } else {
        this.domNode.setAttribute("href", this.constructor.sanitize(value));
      }
    }
  };
  function sanitize(url, protocols) {
    const anchor = document.createElement("a");
    anchor.href = url;
    const protocol = anchor.href.slice(0, anchor.href.indexOf(":"));
    return protocols.indexOf(protocol) > -1;
  }

  // node_modules/quill/formats/script.js
  var Script = class extends inline_default {
    static blotName = "script";
    static tagName = ["SUB", "SUP"];
    static create(value) {
      if (value === "super") {
        return document.createElement("sup");
      }
      if (value === "sub") {
        return document.createElement("sub");
      }
      return super.create(value);
    }
    static formats(domNode) {
      if (domNode.tagName === "SUB")
        return "sub";
      if (domNode.tagName === "SUP")
        return "super";
      return void 0;
    }
  };
  var script_default = Script;

  // node_modules/quill/formats/strike.js
  var Strike = class extends bold_default {
    static blotName = "strike";
    static tagName = ["S", "STRIKE"];
  };
  var strike_default = Strike;

  // node_modules/quill/formats/underline.js
  var Underline = class extends inline_default {
    static blotName = "underline";
    static tagName = "U";
  };
  var underline_default = Underline;

  // node_modules/quill/formats/formula.js
  var Formula = class extends embed_default {
    static blotName = "formula";
    static className = "ql-formula";
    static tagName = "SPAN";
    static create(value) {
      if (window.katex == null) {
        throw new Error("Formula module requires KaTeX.");
      }
      const node = super.create(value);
      if (typeof value === "string") {
        window.katex.render(value, node, {
          throwOnError: false,
          errorColor: "#f00"
        });
        node.setAttribute("data-value", value);
      }
      return node;
    }
    static value(domNode) {
      return domNode.getAttribute("data-value");
    }
    html() {
      const {
        formula
      } = this.value();
      return `<span>${formula}</span>`;
    }
  };
  var formula_default = Formula;

  // node_modules/quill/formats/image.js
  var ATTRIBUTES = ["alt", "height", "width"];
  var Image2 = class extends EmbedBlot$1 {
    static blotName = "image";
    static tagName = "IMG";
    static create(value) {
      const node = super.create(value);
      if (typeof value === "string") {
        node.setAttribute("src", this.sanitize(value));
      }
      return node;
    }
    static formats(domNode) {
      return ATTRIBUTES.reduce((formats, attribute) => {
        if (domNode.hasAttribute(attribute)) {
          formats[attribute] = domNode.getAttribute(attribute);
        }
        return formats;
      }, {});
    }
    static match(url) {
      return /\.(jpe?g|gif|png)$/.test(url) || /^data:image\/.+;base64/.test(url);
    }
    static sanitize(url) {
      return sanitize(url, ["http", "https", "data"]) ? url : "//:0";
    }
    static value(domNode) {
      return domNode.getAttribute("src");
    }
    format(name, value) {
      if (ATTRIBUTES.indexOf(name) > -1) {
        if (value) {
          this.domNode.setAttribute(name, value);
        } else {
          this.domNode.removeAttribute(name);
        }
      } else {
        super.format(name, value);
      }
    }
  };
  var image_default = Image2;

  // node_modules/quill/formats/video.js
  var ATTRIBUTES2 = ["height", "width"];
  var Video = class extends BlockEmbed {
    static blotName = "video";
    static className = "ql-video";
    static tagName = "IFRAME";
    static create(value) {
      const node = super.create(value);
      node.setAttribute("frameborder", "0");
      node.setAttribute("allowfullscreen", "true");
      node.setAttribute("src", this.sanitize(value));
      return node;
    }
    static formats(domNode) {
      return ATTRIBUTES2.reduce((formats, attribute) => {
        if (domNode.hasAttribute(attribute)) {
          formats[attribute] = domNode.getAttribute(attribute);
        }
        return formats;
      }, {});
    }
    static sanitize(url) {
      return Link.sanitize(url);
    }
    static value(domNode) {
      return domNode.getAttribute("src");
    }
    format(name, value) {
      if (ATTRIBUTES2.indexOf(name) > -1) {
        if (value) {
          this.domNode.setAttribute(name, value);
        } else {
          this.domNode.removeAttribute(name);
        }
      } else {
        super.format(name, value);
      }
    }
    html() {
      const {
        video
      } = this.value();
      return `<a href="${video}">${video}</a>`;
    }
  };
  var video_default = Video;

  // node_modules/quill/modules/syntax.js
  var import_quill_delta10 = __toESM(require_Delta(), 1);
  var TokenAttributor = new ClassAttributor$1("code-token", "hljs", {
    scope: Scope.INLINE
  });
  var CodeToken = class _CodeToken extends inline_default {
    static formats(node, scroll) {
      while (node != null && node !== scroll.domNode) {
        if (node.classList && node.classList.contains(CodeBlock.className)) {
          return super.formats(node, scroll);
        }
        node = node.parentNode;
      }
      return void 0;
    }
    constructor(scroll, domNode, value) {
      super(scroll, domNode, value);
      TokenAttributor.add(this.domNode, value);
    }
    format(format, value) {
      if (format !== _CodeToken.blotName) {
        super.format(format, value);
      } else if (value) {
        TokenAttributor.add(this.domNode, value);
      } else {
        TokenAttributor.remove(this.domNode);
        this.domNode.classList.remove(this.statics.className);
      }
    }
    optimize() {
      super.optimize(...arguments);
      if (!TokenAttributor.value(this.domNode)) {
        this.unwrap();
      }
    }
  };
  CodeToken.blotName = "code-token";
  CodeToken.className = "ql-token";
  var SyntaxCodeBlock = class extends CodeBlock {
    static create(value) {
      const domNode = super.create(value);
      if (typeof value === "string") {
        domNode.setAttribute("data-language", value);
      }
      return domNode;
    }
    static formats(domNode) {
      return domNode.getAttribute("data-language") || "plain";
    }
    static register() {
    }
    // Syntax module will register
    format(name, value) {
      if (name === this.statics.blotName && value) {
        this.domNode.setAttribute("data-language", value);
      } else {
        super.format(name, value);
      }
    }
    replaceWith(name, value) {
      this.formatAt(0, this.length(), CodeToken.blotName, false);
      return super.replaceWith(name, value);
    }
  };
  var SyntaxCodeBlockContainer = class extends CodeBlockContainer {
    attach() {
      super.attach();
      this.forceNext = false;
      this.scroll.emitMount(this);
    }
    format(name, value) {
      if (name === SyntaxCodeBlock.blotName) {
        this.forceNext = true;
        this.children.forEach((child) => {
          child.format(name, value);
        });
      }
    }
    formatAt(index, length, name, value) {
      if (name === SyntaxCodeBlock.blotName) {
        this.forceNext = true;
      }
      super.formatAt(index, length, name, value);
    }
    highlight(highlight2) {
      let forced = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      if (this.children.head == null)
        return;
      const nodes = Array.from(this.domNode.childNodes).filter((node) => node !== this.uiNode);
      const text = `${nodes.map((node) => node.textContent).join("\n")}
`;
      const language = SyntaxCodeBlock.formats(this.children.head.domNode);
      if (forced || this.forceNext || this.cachedText !== text) {
        if (text.trim().length > 0 || this.cachedText == null) {
          const oldDelta = this.children.reduce((delta2, child) => {
            return delta2.concat(blockDelta(child, false));
          }, new import_quill_delta10.default());
          const delta = highlight2(text, language);
          oldDelta.diff(delta).reduce((index, _ref) => {
            let {
              retain,
              attributes
            } = _ref;
            if (!retain)
              return index;
            if (attributes) {
              Object.keys(attributes).forEach((format) => {
                if ([SyntaxCodeBlock.blotName, CodeToken.blotName].includes(format)) {
                  this.formatAt(index, retain, format, attributes[format]);
                }
              });
            }
            return index + retain;
          }, 0);
        }
        this.cachedText = text;
        this.forceNext = false;
      }
    }
    html(index, length) {
      const [codeBlock] = this.children.find(index);
      const language = codeBlock ? SyntaxCodeBlock.formats(codeBlock.domNode) : "plain";
      return `<pre data-language="${language}">
${escapeText(this.code(index, length))}
</pre>`;
    }
    optimize(context) {
      super.optimize(context);
      if (this.parent != null && this.children.head != null && this.uiNode != null) {
        const language = SyntaxCodeBlock.formats(this.children.head.domNode);
        if (language !== this.uiNode.value) {
          this.uiNode.value = language;
        }
      }
    }
  };
  SyntaxCodeBlockContainer.allowedChildren = [SyntaxCodeBlock];
  SyntaxCodeBlock.requiredContainer = SyntaxCodeBlockContainer;
  SyntaxCodeBlock.allowedChildren = [CodeToken, cursor_default, Text2, break_default];
  var highlight = (lib, language, text) => {
    if (typeof lib.versionString === "string") {
      const majorVersion = lib.versionString.split(".")[0];
      if (parseInt(majorVersion, 10) >= 11) {
        return lib.highlight(text, {
          language
        }).value;
      }
    }
    return lib.highlight(language, text).value;
  };
  var Syntax = class extends module_default {
    static register() {
      Quill.register(CodeToken, true);
      Quill.register(SyntaxCodeBlock, true);
      Quill.register(SyntaxCodeBlockContainer, true);
    }
    constructor(quill, options) {
      super(quill, options);
      if (this.options.hljs == null) {
        throw new Error("Syntax module requires highlight.js. Please include the library on the page before Quill.");
      }
      this.languages = this.options.languages.reduce((memo, _ref2) => {
        let {
          key
        } = _ref2;
        memo[key] = true;
        return memo;
      }, {});
      this.highlightBlot = this.highlightBlot.bind(this);
      this.initListener();
      this.initTimer();
    }
    initListener() {
      this.quill.on(Quill.events.SCROLL_BLOT_MOUNT, (blot) => {
        if (!(blot instanceof SyntaxCodeBlockContainer))
          return;
        const select = this.quill.root.ownerDocument.createElement("select");
        this.options.languages.forEach((_ref3) => {
          let {
            key,
            label
          } = _ref3;
          const option = select.ownerDocument.createElement("option");
          option.textContent = label;
          option.setAttribute("value", key);
          select.appendChild(option);
        });
        select.addEventListener("change", () => {
          blot.format(SyntaxCodeBlock.blotName, select.value);
          this.quill.root.focus();
          this.highlight(blot, true);
        });
        if (blot.uiNode == null) {
          blot.attachUI(select);
          if (blot.children.head) {
            select.value = SyntaxCodeBlock.formats(blot.children.head.domNode);
          }
        }
      });
    }
    initTimer() {
      let timer = null;
      this.quill.on(Quill.events.SCROLL_OPTIMIZE, () => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          this.highlight();
          timer = null;
        }, this.options.interval);
      });
    }
    highlight() {
      let blot = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : null;
      let force = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      if (this.quill.selection.composing)
        return;
      this.quill.update(Quill.sources.USER);
      const range = this.quill.getSelection();
      const blots = blot == null ? this.quill.scroll.descendants(SyntaxCodeBlockContainer) : [blot];
      blots.forEach((container) => {
        container.highlight(this.highlightBlot, force);
      });
      this.quill.update(Quill.sources.SILENT);
      if (range != null) {
        this.quill.setSelection(range, Quill.sources.SILENT);
      }
    }
    highlightBlot(text) {
      let language = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : "plain";
      language = this.languages[language] ? language : "plain";
      if (language === "plain") {
        return escapeText(text).split("\n").reduce((delta, line, i) => {
          if (i !== 0) {
            delta.insert("\n", {
              [CodeBlock.blotName]: language
            });
          }
          return delta.insert(line);
        }, new import_quill_delta10.default());
      }
      const container = this.quill.root.ownerDocument.createElement("div");
      container.classList.add(CodeBlock.className);
      container.innerHTML = highlight(this.options.hljs, language, text);
      return traverse(this.quill.scroll, container, [(node, delta) => {
        const value = TokenAttributor.value(node);
        if (value) {
          return delta.compose(new import_quill_delta10.default().retain(delta.length(), {
            [CodeToken.blotName]: value
          }));
        }
        return delta;
      }], [(node, delta) => {
        return node.data.split("\n").reduce((memo, nodeText, i) => {
          if (i !== 0)
            memo.insert("\n", {
              [CodeBlock.blotName]: language
            });
          return memo.insert(nodeText);
        }, delta);
      }], /* @__PURE__ */ new WeakMap());
    }
  };
  Syntax.DEFAULTS = {
    hljs: (() => {
      return window.hljs;
    })(),
    interval: 1e3,
    languages: [{
      key: "plain",
      label: "Plain"
    }, {
      key: "bash",
      label: "Bash"
    }, {
      key: "cpp",
      label: "C++"
    }, {
      key: "cs",
      label: "C#"
    }, {
      key: "css",
      label: "CSS"
    }, {
      key: "diff",
      label: "Diff"
    }, {
      key: "xml",
      label: "HTML/XML"
    }, {
      key: "java",
      label: "Java"
    }, {
      key: "javascript",
      label: "JavaScript"
    }, {
      key: "markdown",
      label: "Markdown"
    }, {
      key: "php",
      label: "PHP"
    }, {
      key: "python",
      label: "Python"
    }, {
      key: "ruby",
      label: "Ruby"
    }, {
      key: "sql",
      label: "SQL"
    }]
  };

  // node_modules/quill/modules/table.js
  var import_quill_delta11 = __toESM(require_Delta(), 1);

  // node_modules/quill/formats/table.js
  var TableCell = class _TableCell extends Block {
    static blotName = "table";
    static tagName = "TD";
    static create(value) {
      const node = super.create();
      if (value) {
        node.setAttribute("data-row", value);
      } else {
        node.setAttribute("data-row", tableId());
      }
      return node;
    }
    static formats(domNode) {
      if (domNode.hasAttribute("data-row")) {
        return domNode.getAttribute("data-row");
      }
      return void 0;
    }
    cellOffset() {
      if (this.parent) {
        return this.parent.children.indexOf(this);
      }
      return -1;
    }
    format(name, value) {
      if (name === _TableCell.blotName && value) {
        this.domNode.setAttribute("data-row", value);
      } else {
        super.format(name, value);
      }
    }
    row() {
      return this.parent;
    }
    rowOffset() {
      if (this.row()) {
        return this.row().rowOffset();
      }
      return -1;
    }
    table() {
      return this.row() && this.row().table();
    }
  };
  var TableRow = class extends container_default {
    static blotName = "table-row";
    static tagName = "TR";
    checkMerge() {
      if (super.checkMerge() && this.next.children.head != null) {
        const thisHead = this.children.head.formats();
        const thisTail = this.children.tail.formats();
        const nextHead = this.next.children.head.formats();
        const nextTail = this.next.children.tail.formats();
        return thisHead.table === thisTail.table && thisHead.table === nextHead.table && thisHead.table === nextTail.table;
      }
      return false;
    }
    optimize(context) {
      super.optimize(context);
      this.children.forEach((child) => {
        if (child.next == null)
          return;
        const childFormats = child.formats();
        const nextFormats = child.next.formats();
        if (childFormats.table !== nextFormats.table) {
          const next = this.splitAfter(child);
          if (next) {
            next.optimize();
          }
          if (this.prev) {
            this.prev.optimize();
          }
        }
      });
    }
    rowOffset() {
      if (this.parent) {
        return this.parent.children.indexOf(this);
      }
      return -1;
    }
    table() {
      return this.parent && this.parent.parent;
    }
  };
  var TableBody = class extends container_default {
    static blotName = "table-body";
    static tagName = "TBODY";
  };
  var TableContainer = class extends container_default {
    static blotName = "table-container";
    static tagName = "TABLE";
    balanceCells() {
      const rows = this.descendants(TableRow);
      const maxColumns = rows.reduce((max, row) => {
        return Math.max(row.children.length, max);
      }, 0);
      rows.forEach((row) => {
        new Array(maxColumns - row.children.length).fill(0).forEach(() => {
          let value;
          if (row.children.head != null) {
            value = TableCell.formats(row.children.head.domNode);
          }
          const blot = this.scroll.create(TableCell.blotName, value);
          row.appendChild(blot);
          blot.optimize();
        });
      });
    }
    cells(column) {
      return this.rows().map((row) => row.children.at(column));
    }
    deleteColumn(index) {
      const [body] = this.descendant(TableBody);
      if (body == null || body.children.head == null)
        return;
      body.children.forEach((row) => {
        const cell = row.children.at(index);
        if (cell != null) {
          cell.remove();
        }
      });
    }
    insertColumn(index) {
      const [body] = this.descendant(TableBody);
      if (body == null || body.children.head == null)
        return;
      body.children.forEach((row) => {
        const ref = row.children.at(index);
        const value = TableCell.formats(row.children.head.domNode);
        const cell = this.scroll.create(TableCell.blotName, value);
        row.insertBefore(cell, ref);
      });
    }
    insertRow(index) {
      const [body] = this.descendant(TableBody);
      if (body == null || body.children.head == null)
        return;
      const id = tableId();
      const row = this.scroll.create(TableRow.blotName);
      body.children.head.children.forEach(() => {
        const cell = this.scroll.create(TableCell.blotName, id);
        row.appendChild(cell);
      });
      const ref = body.children.at(index);
      body.insertBefore(row, ref);
    }
    rows() {
      const body = this.children.head;
      if (body == null)
        return [];
      return body.children.map((row) => row);
    }
  };
  TableContainer.allowedChildren = [TableBody];
  TableBody.requiredContainer = TableContainer;
  TableBody.allowedChildren = [TableRow];
  TableRow.requiredContainer = TableBody;
  TableRow.allowedChildren = [TableCell];
  TableCell.requiredContainer = TableRow;
  function tableId() {
    const id = Math.random().toString(36).slice(2, 6);
    return `row-${id}`;
  }

  // node_modules/quill/modules/table.js
  var Table = class extends module_default {
    static register() {
      Quill.register(TableCell);
      Quill.register(TableRow);
      Quill.register(TableBody);
      Quill.register(TableContainer);
    }
    constructor() {
      super(...arguments);
      this.listenBalanceCells();
    }
    balanceTables() {
      this.quill.scroll.descendants(TableContainer).forEach((table) => {
        table.balanceCells();
      });
    }
    deleteColumn() {
      const [table, , cell] = this.getTable();
      if (cell == null)
        return;
      table.deleteColumn(cell.cellOffset());
      this.quill.update(Quill.sources.USER);
    }
    deleteRow() {
      const [, row] = this.getTable();
      if (row == null)
        return;
      row.remove();
      this.quill.update(Quill.sources.USER);
    }
    deleteTable() {
      const [table] = this.getTable();
      if (table == null)
        return;
      const offset = table.offset();
      table.remove();
      this.quill.update(Quill.sources.USER);
      this.quill.setSelection(offset, Quill.sources.SILENT);
    }
    getTable() {
      let range = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.quill.getSelection();
      if (range == null)
        return [null, null, null, -1];
      const [cell, offset] = this.quill.getLine(range.index);
      if (cell == null || cell.statics.blotName !== TableCell.blotName) {
        return [null, null, null, -1];
      }
      const row = cell.parent;
      const table = row.parent.parent;
      return [table, row, cell, offset];
    }
    insertColumn(offset) {
      const range = this.quill.getSelection();
      if (!range)
        return;
      const [table, row, cell] = this.getTable(range);
      if (cell == null)
        return;
      const column = cell.cellOffset();
      table.insertColumn(column + offset);
      this.quill.update(Quill.sources.USER);
      let shift = row.rowOffset();
      if (offset === 0) {
        shift += 1;
      }
      this.quill.setSelection(range.index + shift, range.length, Quill.sources.SILENT);
    }
    insertColumnLeft() {
      this.insertColumn(0);
    }
    insertColumnRight() {
      this.insertColumn(1);
    }
    insertRow(offset) {
      const range = this.quill.getSelection();
      if (!range)
        return;
      const [table, row, cell] = this.getTable(range);
      if (cell == null)
        return;
      const index = row.rowOffset();
      table.insertRow(index + offset);
      this.quill.update(Quill.sources.USER);
      if (offset > 0) {
        this.quill.setSelection(range, Quill.sources.SILENT);
      } else {
        this.quill.setSelection(range.index + row.children.length, range.length, Quill.sources.SILENT);
      }
    }
    insertRowAbove() {
      this.insertRow(0);
    }
    insertRowBelow() {
      this.insertRow(1);
    }
    insertTable(rows, columns) {
      const range = this.quill.getSelection();
      if (range == null)
        return;
      const delta = new Array(rows).fill(0).reduce((memo) => {
        const text = new Array(columns).fill("\n").join("");
        return memo.insert(text, {
          table: tableId()
        });
      }, new import_quill_delta11.default().retain(range.index));
      this.quill.updateContents(delta, Quill.sources.USER);
      this.quill.setSelection(range.index, Quill.sources.SILENT);
      this.balanceTables();
    }
    listenBalanceCells() {
      this.quill.on(Quill.events.SCROLL_OPTIMIZE, (mutations) => {
        mutations.some((mutation) => {
          if (["TD", "TR", "TBODY", "TABLE"].includes(mutation.target.tagName)) {
            this.quill.once(Quill.events.TEXT_CHANGE, (delta, old, source) => {
              if (source !== Quill.sources.USER)
                return;
              this.balanceTables();
            });
            return true;
          }
          return false;
        });
      });
    }
  };
  var table_default = Table;

  // node_modules/quill/modules/toolbar.js
  var import_quill_delta12 = __toESM(require_Delta(), 1);
  var debug8 = logger_default("quill:toolbar");
  var Toolbar = class extends module_default {
    constructor(quill, options) {
      super(quill, options);
      if (Array.isArray(this.options.container)) {
        const container = document.createElement("div");
        container.setAttribute("role", "toolbar");
        addControls(container, this.options.container);
        quill.container?.parentNode?.insertBefore(container, quill.container);
        this.container = container;
      } else if (typeof this.options.container === "string") {
        this.container = document.querySelector(this.options.container);
      } else {
        this.container = this.options.container;
      }
      if (!(this.container instanceof HTMLElement)) {
        debug8.error("Container required for toolbar", this.options);
        return;
      }
      this.container.classList.add("ql-toolbar");
      this.controls = [];
      this.handlers = {};
      if (this.options.handlers) {
        Object.keys(this.options.handlers).forEach((format) => {
          const handler = this.options.handlers?.[format];
          if (handler) {
            this.addHandler(format, handler);
          }
        });
      }
      Array.from(this.container.querySelectorAll("button, select")).forEach((input) => {
        this.attach(input);
      });
      this.quill.on(Quill.events.EDITOR_CHANGE, () => {
        const [range] = this.quill.selection.getRange();
        this.update(range);
      });
    }
    addHandler(format, handler) {
      this.handlers[format] = handler;
    }
    attach(input) {
      let format = Array.from(input.classList).find((className) => {
        return className.indexOf("ql-") === 0;
      });
      if (!format)
        return;
      format = format.slice("ql-".length);
      if (input.tagName === "BUTTON") {
        input.setAttribute("type", "button");
      }
      if (this.handlers[format] == null && this.quill.scroll.query(format) == null) {
        debug8.warn("ignoring attaching to nonexistent format", format, input);
        return;
      }
      const eventName = input.tagName === "SELECT" ? "change" : "click";
      input.addEventListener(eventName, (e) => {
        let value;
        if (input.tagName === "SELECT") {
          if (input.selectedIndex < 0)
            return;
          const selected = input.options[input.selectedIndex];
          if (selected.hasAttribute("selected")) {
            value = false;
          } else {
            value = selected.value || false;
          }
        } else {
          if (input.classList.contains("ql-active")) {
            value = false;
          } else {
            value = input.value || !input.hasAttribute("value");
          }
          e.preventDefault();
        }
        this.quill.focus();
        const [range] = this.quill.selection.getRange();
        if (this.handlers[format] != null) {
          this.handlers[format].call(this, value);
        } else if (
          // @ts-expect-error
          this.quill.scroll.query(format).prototype instanceof EmbedBlot$1
        ) {
          value = prompt(`Enter ${format}`);
          if (!value)
            return;
          this.quill.updateContents(new import_quill_delta12.default().retain(range.index).delete(range.length).insert({
            [format]: value
          }), Quill.sources.USER);
        } else {
          this.quill.format(format, value, Quill.sources.USER);
        }
        this.update(range);
      });
      this.controls.push([format, input]);
    }
    update(range) {
      const formats = range == null ? {} : this.quill.getFormat(range);
      this.controls.forEach((pair) => {
        const [format, input] = pair;
        if (input.tagName === "SELECT") {
          let option = null;
          if (range == null) {
            option = null;
          } else if (formats[format] == null) {
            option = input.querySelector("option[selected]");
          } else if (!Array.isArray(formats[format])) {
            let value = formats[format];
            if (typeof value === "string") {
              value = value.replace(/"/g, '\\"');
            }
            option = input.querySelector(`option[value="${value}"]`);
          }
          if (option == null) {
            input.value = "";
            input.selectedIndex = -1;
          } else {
            option.selected = true;
          }
        } else if (range == null) {
          input.classList.remove("ql-active");
          input.setAttribute("aria-pressed", "false");
        } else if (input.hasAttribute("value")) {
          const value = formats[format];
          const isActive = value === input.getAttribute("value") || value != null && value.toString() === input.getAttribute("value") || value == null && !input.getAttribute("value");
          input.classList.toggle("ql-active", isActive);
          input.setAttribute("aria-pressed", isActive.toString());
        } else {
          const isActive = formats[format] != null;
          input.classList.toggle("ql-active", isActive);
          input.setAttribute("aria-pressed", isActive.toString());
        }
      });
    }
  };
  Toolbar.DEFAULTS = {};
  function addButton(container, format, value) {
    const input = document.createElement("button");
    input.setAttribute("type", "button");
    input.classList.add(`ql-${format}`);
    input.setAttribute("aria-pressed", "false");
    if (value != null) {
      input.value = value;
      input.setAttribute("aria-label", `${format}: ${value}`);
    } else {
      input.setAttribute("aria-label", format);
    }
    container.appendChild(input);
  }
  function addControls(container, groups) {
    if (!Array.isArray(groups[0])) {
      groups = [groups];
    }
    groups.forEach((controls) => {
      const group = document.createElement("span");
      group.classList.add("ql-formats");
      controls.forEach((control) => {
        if (typeof control === "string") {
          addButton(group, control);
        } else {
          const format = Object.keys(control)[0];
          const value = control[format];
          if (Array.isArray(value)) {
            addSelect(group, format, value);
          } else {
            addButton(group, format, value);
          }
        }
      });
      container.appendChild(group);
    });
  }
  function addSelect(container, format, values) {
    const input = document.createElement("select");
    input.classList.add(`ql-${format}`);
    values.forEach((value) => {
      const option = document.createElement("option");
      if (value !== false) {
        option.setAttribute("value", String(value));
      } else {
        option.setAttribute("selected", "selected");
      }
      input.appendChild(option);
    });
    container.appendChild(input);
  }
  Toolbar.DEFAULTS = {
    container: null,
    handlers: {
      clean() {
        const range = this.quill.getSelection();
        if (range == null)
          return;
        if (range.length === 0) {
          const formats = this.quill.getFormat();
          Object.keys(formats).forEach((name) => {
            if (this.quill.scroll.query(name, Scope.INLINE) != null) {
              this.quill.format(name, false, Quill.sources.USER);
            }
          });
        } else {
          this.quill.removeFormat(range.index, range.length, Quill.sources.USER);
        }
      },
      direction(value) {
        const {
          align
        } = this.quill.getFormat();
        if (value === "rtl" && align == null) {
          this.quill.format("align", "right", Quill.sources.USER);
        } else if (!value && align === "right") {
          this.quill.format("align", false, Quill.sources.USER);
        }
        this.quill.format("direction", value, Quill.sources.USER);
      },
      indent(value) {
        const range = this.quill.getSelection();
        const formats = this.quill.getFormat(range);
        const indent = parseInt(formats.indent || 0, 10);
        if (value === "+1" || value === "-1") {
          let modifier = value === "+1" ? 1 : -1;
          if (formats.direction === "rtl")
            modifier *= -1;
          this.quill.format("indent", indent + modifier, Quill.sources.USER);
        }
      },
      link(value) {
        if (value === true) {
          value = prompt("Enter link URL:");
        }
        this.quill.format("link", value, Quill.sources.USER);
      },
      list(value) {
        const range = this.quill.getSelection();
        const formats = this.quill.getFormat(range);
        if (value === "check") {
          if (formats.list === "checked" || formats.list === "unchecked") {
            this.quill.format("list", false, Quill.sources.USER);
          } else {
            this.quill.format("list", "unchecked", Quill.sources.USER);
          }
        } else {
          this.quill.format("list", value, Quill.sources.USER);
        }
      }
    }
  };

  // node_modules/quill/ui/icons.js
  var alignLeftIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="3" x2="15" y1="9" y2="9"/><line class="ql-stroke" x1="3" x2="13" y1="14" y2="14"/><line class="ql-stroke" x1="3" x2="9" y1="4" y2="4"/></svg>';
  var alignCenterIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="15" x2="3" y1="9" y2="9"/><line class="ql-stroke" x1="14" x2="4" y1="14" y2="14"/><line class="ql-stroke" x1="12" x2="6" y1="4" y2="4"/></svg>';
  var alignRightIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="15" x2="3" y1="9" y2="9"/><line class="ql-stroke" x1="15" x2="5" y1="14" y2="14"/><line class="ql-stroke" x1="15" x2="9" y1="4" y2="4"/></svg>';
  var alignJustifyIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="15" x2="3" y1="9" y2="9"/><line class="ql-stroke" x1="15" x2="3" y1="14" y2="14"/><line class="ql-stroke" x1="15" x2="3" y1="4" y2="4"/></svg>';
  var backgroundIcon = '<svg viewbox="0 0 18 18"><g class="ql-fill ql-color-label"><polygon points="6 6.868 6 6 5 6 5 7 5.942 7 6 6.868"/><rect height="1" width="1" x="4" y="4"/><polygon points="6.817 5 6 5 6 6 6.38 6 6.817 5"/><rect height="1" width="1" x="2" y="6"/><rect height="1" width="1" x="3" y="5"/><rect height="1" width="1" x="4" y="7"/><polygon points="4 11.439 4 11 3 11 3 12 3.755 12 4 11.439"/><rect height="1" width="1" x="2" y="12"/><rect height="1" width="1" x="2" y="9"/><rect height="1" width="1" x="2" y="15"/><polygon points="4.63 10 4 10 4 11 4.192 11 4.63 10"/><rect height="1" width="1" x="3" y="8"/><path d="M10.832,4.2L11,4.582V4H10.708A1.948,1.948,0,0,1,10.832,4.2Z"/><path d="M7,4.582L7.168,4.2A1.929,1.929,0,0,1,7.292,4H7V4.582Z"/><path d="M8,13H7.683l-0.351.8a1.933,1.933,0,0,1-.124.2H8V13Z"/><rect height="1" width="1" x="12" y="2"/><rect height="1" width="1" x="11" y="3"/><path d="M9,3H8V3.282A1.985,1.985,0,0,1,9,3Z"/><rect height="1" width="1" x="2" y="3"/><rect height="1" width="1" x="6" y="2"/><rect height="1" width="1" x="3" y="2"/><rect height="1" width="1" x="5" y="3"/><rect height="1" width="1" x="9" y="2"/><rect height="1" width="1" x="15" y="14"/><polygon points="13.447 10.174 13.469 10.225 13.472 10.232 13.808 11 14 11 14 10 13.37 10 13.447 10.174"/><rect height="1" width="1" x="13" y="7"/><rect height="1" width="1" x="15" y="5"/><rect height="1" width="1" x="14" y="6"/><rect height="1" width="1" x="15" y="8"/><rect height="1" width="1" x="14" y="9"/><path d="M3.775,14H3v1H4V14.314A1.97,1.97,0,0,1,3.775,14Z"/><rect height="1" width="1" x="14" y="3"/><polygon points="12 6.868 12 6 11.62 6 12 6.868"/><rect height="1" width="1" x="15" y="2"/><rect height="1" width="1" x="12" y="5"/><rect height="1" width="1" x="13" y="4"/><polygon points="12.933 9 13 9 13 8 12.495 8 12.933 9"/><rect height="1" width="1" x="9" y="14"/><rect height="1" width="1" x="8" y="15"/><path d="M6,14.926V15H7V14.316A1.993,1.993,0,0,1,6,14.926Z"/><rect height="1" width="1" x="5" y="15"/><path d="M10.668,13.8L10.317,13H10v1h0.792A1.947,1.947,0,0,1,10.668,13.8Z"/><rect height="1" width="1" x="11" y="15"/><path d="M14.332,12.2a1.99,1.99,0,0,1,.166.8H15V12H14.245Z"/><rect height="1" width="1" x="14" y="15"/><rect height="1" width="1" x="15" y="11"/></g><polyline class="ql-stroke" points="5.5 13 9 5 12.5 13"/><line class="ql-stroke" x1="11.63" x2="6.38" y1="11" y2="11"/></svg>';
  var blockquoteIcon = '<svg viewbox="0 0 18 18"><rect class="ql-fill ql-stroke" height="3" width="3" x="4" y="5"/><rect class="ql-fill ql-stroke" height="3" width="3" x="11" y="5"/><path class="ql-even ql-fill ql-stroke" d="M7,8c0,4.031-3,5-3,5"/><path class="ql-even ql-fill ql-stroke" d="M14,8c0,4.031-3,5-3,5"/></svg>';
  var boldIcon = '<svg viewbox="0 0 18 18"><path class="ql-stroke" d="M5,4H9.5A2.5,2.5,0,0,1,12,6.5v0A2.5,2.5,0,0,1,9.5,9H5A0,0,0,0,1,5,9V4A0,0,0,0,1,5,4Z"/><path class="ql-stroke" d="M5,9h5.5A2.5,2.5,0,0,1,13,11.5v0A2.5,2.5,0,0,1,10.5,14H5a0,0,0,0,1,0,0V9A0,0,0,0,1,5,9Z"/></svg>';
  var cleanIcon = '<svg class="" viewbox="0 0 18 18"><line class="ql-stroke" x1="5" x2="13" y1="3" y2="3"/><line class="ql-stroke" x1="6" x2="9.35" y1="12" y2="3"/><line class="ql-stroke" x1="11" x2="15" y1="11" y2="15"/><line class="ql-stroke" x1="15" x2="11" y1="11" y2="15"/><rect class="ql-fill" height="1" rx="0.5" ry="0.5" width="7" x="2" y="14"/></svg>';
  var codeIcon = '<svg viewbox="0 0 18 18"><polyline class="ql-even ql-stroke" points="5 7 3 9 5 11"/><polyline class="ql-even ql-stroke" points="13 7 15 9 13 11"/><line class="ql-stroke" x1="10" x2="8" y1="5" y2="13"/></svg>';
  var colorIcon = '<svg viewbox="0 0 18 18"><line class="ql-color-label ql-stroke ql-transparent" x1="3" x2="15" y1="15" y2="15"/><polyline class="ql-stroke" points="5.5 11 9 3 12.5 11"/><line class="ql-stroke" x1="11.63" x2="6.38" y1="9" y2="9"/></svg>';
  var directionLeftToRightIcon = '<svg viewbox="0 0 18 18"><polygon class="ql-stroke ql-fill" points="3 11 5 9 3 7 3 11"/><line class="ql-stroke ql-fill" x1="15" x2="11" y1="4" y2="4"/><path class="ql-fill" d="M11,3a3,3,0,0,0,0,6h1V3H11Z"/><rect class="ql-fill" height="11" width="1" x="11" y="4"/><rect class="ql-fill" height="11" width="1" x="13" y="4"/></svg>';
  var directionRightToLeftIcon = '<svg viewbox="0 0 18 18"><polygon class="ql-stroke ql-fill" points="15 12 13 10 15 8 15 12"/><line class="ql-stroke ql-fill" x1="9" x2="5" y1="4" y2="4"/><path class="ql-fill" d="M5,3A3,3,0,0,0,5,9H6V3H5Z"/><rect class="ql-fill" height="11" width="1" x="5" y="4"/><rect class="ql-fill" height="11" width="1" x="7" y="4"/></svg>';
  var formulaIcon = '<svg viewbox="0 0 18 18"><path class="ql-fill" d="M11.759,2.482a2.561,2.561,0,0,0-3.53.607A7.656,7.656,0,0,0,6.8,6.2C6.109,9.188,5.275,14.677,4.15,14.927a1.545,1.545,0,0,0-1.3-.933A0.922,0.922,0,0,0,2,15.036S1.954,16,4.119,16s3.091-2.691,3.7-5.553c0.177-.826.36-1.726,0.554-2.6L8.775,6.2c0.381-1.421.807-2.521,1.306-2.676a1.014,1.014,0,0,0,1.02.56A0.966,0.966,0,0,0,11.759,2.482Z"/><rect class="ql-fill" height="1.6" rx="0.8" ry="0.8" width="5" x="5.15" y="6.2"/><path class="ql-fill" d="M13.663,12.027a1.662,1.662,0,0,1,.266-0.276q0.193,0.069.456,0.138a2.1,2.1,0,0,0,.535.069,1.075,1.075,0,0,0,.767-0.3,1.044,1.044,0,0,0,.314-0.8,0.84,0.84,0,0,0-.238-0.619,0.8,0.8,0,0,0-.594-0.239,1.154,1.154,0,0,0-.781.3,4.607,4.607,0,0,0-.781,1q-0.091.15-.218,0.346l-0.246.38c-0.068-.288-0.137-0.582-0.212-0.885-0.459-1.847-2.494-.984-2.941-0.8-0.482.2-.353,0.647-0.094,0.529a0.869,0.869,0,0,1,1.281.585c0.217,0.751.377,1.436,0.527,2.038a5.688,5.688,0,0,1-.362.467,2.69,2.69,0,0,1-.264.271q-0.221-.08-0.471-0.147a2.029,2.029,0,0,0-.522-0.066,1.079,1.079,0,0,0-.768.3A1.058,1.058,0,0,0,9,15.131a0.82,0.82,0,0,0,.832.852,1.134,1.134,0,0,0,.787-0.3,5.11,5.11,0,0,0,.776-0.993q0.141-.219.215-0.34c0.046-.076.122-0.194,0.223-0.346a2.786,2.786,0,0,0,.918,1.726,2.582,2.582,0,0,0,2.376-.185c0.317-.181.212-0.565,0-0.494A0.807,0.807,0,0,1,14.176,15a5.159,5.159,0,0,1-.913-2.446l0,0Q13.487,12.24,13.663,12.027Z"/></svg>';
  var headerIcon = '<svg viewBox="0 0 18 18"><path class="ql-fill" d="M10,4V14a1,1,0,0,1-2,0V10H3v4a1,1,0,0,1-2,0V4A1,1,0,0,1,3,4V8H8V4a1,1,0,0,1,2,0Zm6.06787,9.209H14.98975V7.59863a.54085.54085,0,0,0-.605-.60547h-.62744a1.01119,1.01119,0,0,0-.748.29688L11.645,8.56641a.5435.5435,0,0,0-.022.8584l.28613.30762a.53861.53861,0,0,0,.84717.0332l.09912-.08789a1.2137,1.2137,0,0,0,.2417-.35254h.02246s-.01123.30859-.01123.60547V13.209H12.041a.54085.54085,0,0,0-.605.60547v.43945a.54085.54085,0,0,0,.605.60547h4.02686a.54085.54085,0,0,0,.605-.60547v-.43945A.54085.54085,0,0,0,16.06787,13.209Z"/></svg>';
  var header2Icon = '<svg viewBox="0 0 18 18"><path class="ql-fill" d="M16.73975,13.81445v.43945a.54085.54085,0,0,1-.605.60547H11.855a.58392.58392,0,0,1-.64893-.60547V14.0127c0-2.90527,3.39941-3.42187,3.39941-4.55469a.77675.77675,0,0,0-.84717-.78125,1.17684,1.17684,0,0,0-.83594.38477c-.2749.26367-.561.374-.85791.13184l-.4292-.34082c-.30811-.24219-.38525-.51758-.1543-.81445a2.97155,2.97155,0,0,1,2.45361-1.17676,2.45393,2.45393,0,0,1,2.68408,2.40918c0,2.45312-3.1792,2.92676-3.27832,3.93848h2.79443A.54085.54085,0,0,1,16.73975,13.81445ZM9,3A.99974.99974,0,0,0,8,4V8H3V4A1,1,0,0,0,1,4V14a1,1,0,0,0,2,0V10H8v4a1,1,0,0,0,2,0V4A.99974.99974,0,0,0,9,3Z"/></svg>';
  var header3Icon = '<svg viewBox="0 0 18 18"><path class="ql-fill" d="M16.65186,12.30664a2.6742,2.6742,0,0,1-2.915,2.68457,3.96592,3.96592,0,0,1-2.25537-.6709.56007.56007,0,0,1-.13232-.83594L11.64648,13c.209-.34082.48389-.36328.82471-.1543a2.32654,2.32654,0,0,0,1.12256.33008c.71484,0,1.12207-.35156,1.12207-.78125,0-.61523-.61621-.86816-1.46338-.86816H13.2085a.65159.65159,0,0,1-.68213-.41895l-.05518-.10937a.67114.67114,0,0,1,.14307-.78125l.71533-.86914a8.55289,8.55289,0,0,1,.68213-.7373V8.58887a3.93913,3.93913,0,0,1-.748.05469H11.9873a.54085.54085,0,0,1-.605-.60547V7.59863a.54085.54085,0,0,1,.605-.60547h3.75146a.53773.53773,0,0,1,.60547.59375v.17676a1.03723,1.03723,0,0,1-.27539.748L14.74854,10.0293A2.31132,2.31132,0,0,1,16.65186,12.30664ZM9,3A.99974.99974,0,0,0,8,4V8H3V4A1,1,0,0,0,1,4V14a1,1,0,0,0,2,0V10H8v4a1,1,0,0,0,2,0V4A.99974.99974,0,0,0,9,3Z"/></svg>';
  var header4Icon = '<svg viewBox="0 0 18 18"><path class="ql-fill" d="M10,4V14a1,1,0,0,1-2,0V10H3v4a1,1,0,0,1-2,0V4A1,1,0,0,1,3,4V8H8V4a1,1,0,0,1,2,0Zm7.05371,7.96582v.38477c0,.39648-.165.60547-.46191.60547h-.47314v1.29785a.54085.54085,0,0,1-.605.60547h-.69336a.54085.54085,0,0,1-.605-.60547V12.95605H11.333a.5412.5412,0,0,1-.60547-.60547v-.15332a1.199,1.199,0,0,1,.22021-.748l2.56348-4.05957a.7819.7819,0,0,1,.72607-.39648h1.27637a.54085.54085,0,0,1,.605.60547v3.7627h.33008A.54055.54055,0,0,1,17.05371,11.96582ZM14.28125,8.7207h-.022a4.18969,4.18969,0,0,1-.38525.81348l-1.188,1.80469v.02246h1.5293V9.60059A7.04058,7.04058,0,0,1,14.28125,8.7207Z"/></svg>';
  var header5Icon = '<svg viewBox="0 0 18 18"><path class="ql-fill" d="M16.74023,12.18555a2.75131,2.75131,0,0,1-2.91553,2.80566,3.908,3.908,0,0,1-2.25537-.68164.54809.54809,0,0,1-.13184-.8252L11.73438,13c.209-.34082.48389-.36328.8252-.1543a2.23757,2.23757,0,0,0,1.1001.33008,1.01827,1.01827,0,0,0,1.1001-.96777c0-.61621-.53906-.97949-1.25439-.97949a2.15554,2.15554,0,0,0-.64893.09961,1.15209,1.15209,0,0,1-.814.01074l-.12109-.04395a.64116.64116,0,0,1-.45117-.71484l.231-3.00391a.56666.56666,0,0,1,.62744-.583H15.541a.54085.54085,0,0,1,.605.60547v.43945a.54085.54085,0,0,1-.605.60547H13.41748l-.04395.72559a1.29306,1.29306,0,0,1-.04395.30859h.022a2.39776,2.39776,0,0,1,.57227-.07715A2.53266,2.53266,0,0,1,16.74023,12.18555ZM9,3A.99974.99974,0,0,0,8,4V8H3V4A1,1,0,0,0,1,4V14a1,1,0,0,0,2,0V10H8v4a1,1,0,0,0,2,0V4A.99974.99974,0,0,0,9,3Z"/></svg>';
  var header6Icon = '<svg viewBox="0 0 18 18"><path class="ql-fill" d="M14.51758,9.64453a1.85627,1.85627,0,0,0-1.24316.38477H13.252a1.73532,1.73532,0,0,1,1.72754-1.4082,2.66491,2.66491,0,0,1,.5498.06641c.35254.05469.57227.01074.70508-.40723l.16406-.5166a.53393.53393,0,0,0-.373-.75977,4.83723,4.83723,0,0,0-1.17773-.14258c-2.43164,0-3.7627,2.17773-3.7627,4.43359,0,2.47559,1.60645,3.69629,3.19043,3.69629A2.70585,2.70585,0,0,0,16.96,12.19727,2.43861,2.43861,0,0,0,14.51758,9.64453Zm-.23047,3.58691c-.67187,0-1.22168-.81445-1.22168-1.45215,0-.47363.30762-.583.72559-.583.96875,0,1.27734.59375,1.27734,1.12207A.82182.82182,0,0,1,14.28711,13.23145ZM10,4V14a1,1,0,0,1-2,0V10H3v4a1,1,0,0,1-2,0V4A1,1,0,0,1,3,4V8H8V4a1,1,0,0,1,2,0Z"/></svg>';
  var italicIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="7" x2="13" y1="4" y2="4"/><line class="ql-stroke" x1="5" x2="11" y1="14" y2="14"/><line class="ql-stroke" x1="8" x2="10" y1="14" y2="4"/></svg>';
  var imageIcon = '<svg viewbox="0 0 18 18"><rect class="ql-stroke" height="10" width="12" x="3" y="4"/><circle class="ql-fill" cx="6" cy="7" r="1"/><polyline class="ql-even ql-fill" points="5 12 5 11 7 9 8 10 11 7 13 9 13 12 5 12"/></svg>';
  var indentIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="3" x2="15" y1="14" y2="14"/><line class="ql-stroke" x1="3" x2="15" y1="4" y2="4"/><line class="ql-stroke" x1="9" x2="15" y1="9" y2="9"/><polyline class="ql-fill ql-stroke" points="3 7 3 11 5 9 3 7"/></svg>';
  var outdentIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="3" x2="15" y1="14" y2="14"/><line class="ql-stroke" x1="3" x2="15" y1="4" y2="4"/><line class="ql-stroke" x1="9" x2="15" y1="9" y2="9"/><polyline class="ql-stroke" points="5 7 5 11 3 9 5 7"/></svg>';
  var linkIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="7" x2="11" y1="7" y2="11"/><path class="ql-even ql-stroke" d="M8.9,4.577a3.476,3.476,0,0,1,.36,4.679A3.476,3.476,0,0,1,4.577,8.9C3.185,7.5,2.035,6.4,4.217,4.217S7.5,3.185,8.9,4.577Z"/><path class="ql-even ql-stroke" d="M13.423,9.1a3.476,3.476,0,0,0-4.679-.36,3.476,3.476,0,0,0,.36,4.679c1.392,1.392,2.5,2.542,4.679.36S14.815,10.5,13.423,9.1Z"/></svg>';
  var listBulletIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="6" x2="15" y1="4" y2="4"/><line class="ql-stroke" x1="6" x2="15" y1="9" y2="9"/><line class="ql-stroke" x1="6" x2="15" y1="14" y2="14"/><line class="ql-stroke" x1="3" x2="3" y1="4" y2="4"/><line class="ql-stroke" x1="3" x2="3" y1="9" y2="9"/><line class="ql-stroke" x1="3" x2="3" y1="14" y2="14"/></svg>';
  var listCheckIcon = '<svg class="" viewbox="0 0 18 18"><line class="ql-stroke" x1="9" x2="15" y1="4" y2="4"/><polyline class="ql-stroke" points="3 4 4 5 6 3"/><line class="ql-stroke" x1="9" x2="15" y1="14" y2="14"/><polyline class="ql-stroke" points="3 14 4 15 6 13"/><line class="ql-stroke" x1="9" x2="15" y1="9" y2="9"/><polyline class="ql-stroke" points="3 9 4 10 6 8"/></svg>';
  var listOrderedIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke" x1="7" x2="15" y1="4" y2="4"/><line class="ql-stroke" x1="7" x2="15" y1="9" y2="9"/><line class="ql-stroke" x1="7" x2="15" y1="14" y2="14"/><line class="ql-stroke ql-thin" x1="2.5" x2="4.5" y1="5.5" y2="5.5"/><path class="ql-fill" d="M3.5,6A0.5,0.5,0,0,1,3,5.5V3.085l-0.276.138A0.5,0.5,0,0,1,2.053,3c-0.124-.247-0.023-0.324.224-0.447l1-.5A0.5,0.5,0,0,1,4,2.5v3A0.5,0.5,0,0,1,3.5,6Z"/><path class="ql-stroke ql-thin" d="M4.5,10.5h-2c0-.234,1.85-1.076,1.85-2.234A0.959,0.959,0,0,0,2.5,8.156"/><path class="ql-stroke ql-thin" d="M2.5,14.846a0.959,0.959,0,0,0,1.85-.109A0.7,0.7,0,0,0,3.75,14a0.688,0.688,0,0,0,.6-0.736,0.959,0.959,0,0,0-1.85-.109"/></svg>';
  var subscriptIcon = '<svg viewbox="0 0 18 18"><path class="ql-fill" d="M15.5,15H13.861a3.858,3.858,0,0,0,1.914-2.975,1.8,1.8,0,0,0-1.6-1.751A1.921,1.921,0,0,0,12.021,11.7a0.50013,0.50013,0,1,0,.957.291h0a0.914,0.914,0,0,1,1.053-.725,0.81,0.81,0,0,1,.744.762c0,1.076-1.16971,1.86982-1.93971,2.43082A1.45639,1.45639,0,0,0,12,15.5a0.5,0.5,0,0,0,.5.5h3A0.5,0.5,0,0,0,15.5,15Z"/><path class="ql-fill" d="M9.65,5.241a1,1,0,0,0-1.409.108L6,7.964,3.759,5.349A1,1,0,0,0,2.192,6.59178Q2.21541,6.6213,2.241,6.649L4.684,9.5,2.241,12.35A1,1,0,0,0,3.71,13.70722q0.02557-.02768.049-0.05722L6,11.036,8.241,13.65a1,1,0,1,0,1.567-1.24277Q9.78459,12.3777,9.759,12.35L7.316,9.5,9.759,6.651A1,1,0,0,0,9.65,5.241Z"/></svg>';
  var superscriptIcon = '<svg viewbox="0 0 18 18"><path class="ql-fill" d="M15.5,7H13.861a4.015,4.015,0,0,0,1.914-2.975,1.8,1.8,0,0,0-1.6-1.751A1.922,1.922,0,0,0,12.021,3.7a0.5,0.5,0,1,0,.957.291,0.917,0.917,0,0,1,1.053-.725,0.81,0.81,0,0,1,.744.762c0,1.077-1.164,1.925-1.934,2.486A1.423,1.423,0,0,0,12,7.5a0.5,0.5,0,0,0,.5.5h3A0.5,0.5,0,0,0,15.5,7Z"/><path class="ql-fill" d="M9.651,5.241a1,1,0,0,0-1.41.108L6,7.964,3.759,5.349a1,1,0,1,0-1.519,1.3L4.683,9.5,2.241,12.35a1,1,0,1,0,1.519,1.3L6,11.036,8.241,13.65a1,1,0,0,0,1.519-1.3L7.317,9.5,9.759,6.651A1,1,0,0,0,9.651,5.241Z"/></svg>';
  var strikeIcon = '<svg viewbox="0 0 18 18"><line class="ql-stroke ql-thin" x1="15.5" x2="2.5" y1="8.5" y2="9.5"/><path class="ql-fill" d="M9.007,8C6.542,7.791,6,7.519,6,6.5,6,5.792,7.283,5,9,5c1.571,0,2.765.679,2.969,1.309a1,1,0,0,0,1.9-.617C13.356,4.106,11.354,3,9,3,6.2,3,4,4.538,4,6.5a3.2,3.2,0,0,0,.5,1.843Z"/><path class="ql-fill" d="M8.984,10C11.457,10.208,12,10.479,12,11.5c0,0.708-1.283,1.5-3,1.5-1.571,0-2.765-.679-2.969-1.309a1,1,0,1,0-1.9.617C4.644,13.894,6.646,15,9,15c2.8,0,5-1.538,5-3.5a3.2,3.2,0,0,0-.5-1.843Z"/></svg>';
  var tableIcon = '<svg viewbox="0 0 18 18"><rect class="ql-stroke" height="12" width="12" x="3" y="3"/><rect class="ql-fill" height="2" width="3" x="5" y="5"/><rect class="ql-fill" height="2" width="4" x="9" y="5"/><g class="ql-fill ql-transparent"><rect height="2" width="3" x="5" y="8"/><rect height="2" width="4" x="9" y="8"/><rect height="2" width="3" x="5" y="11"/><rect height="2" width="4" x="9" y="11"/></g></svg>';
  var underlineIcon = '<svg viewbox="0 0 18 18"><path class="ql-stroke" d="M5,3V9a4.012,4.012,0,0,0,4,4H9a4.012,4.012,0,0,0,4-4V3"/><rect class="ql-fill" height="1" rx="0.5" ry="0.5" width="12" x="3" y="15"/></svg>';
  var videoIcon = '<svg viewbox="0 0 18 18"><rect class="ql-stroke" height="12" width="12" x="3" y="3"/><rect class="ql-fill" height="12" width="1" x="5" y="3"/><rect class="ql-fill" height="12" width="1" x="12" y="3"/><rect class="ql-fill" height="2" width="8" x="5" y="8"/><rect class="ql-fill" height="1" width="3" x="3" y="5"/><rect class="ql-fill" height="1" width="3" x="3" y="7"/><rect class="ql-fill" height="1" width="3" x="3" y="10"/><rect class="ql-fill" height="1" width="3" x="3" y="12"/><rect class="ql-fill" height="1" width="3" x="12" y="5"/><rect class="ql-fill" height="1" width="3" x="12" y="7"/><rect class="ql-fill" height="1" width="3" x="12" y="10"/><rect class="ql-fill" height="1" width="3" x="12" y="12"/></svg>';
  var icons_default = {
    align: {
      "": alignLeftIcon,
      center: alignCenterIcon,
      right: alignRightIcon,
      justify: alignJustifyIcon
    },
    background: backgroundIcon,
    blockquote: blockquoteIcon,
    bold: boldIcon,
    clean: cleanIcon,
    code: codeIcon,
    "code-block": codeIcon,
    color: colorIcon,
    direction: {
      "": directionLeftToRightIcon,
      rtl: directionRightToLeftIcon
    },
    formula: formulaIcon,
    header: {
      "1": headerIcon,
      "2": header2Icon,
      "3": header3Icon,
      "4": header4Icon,
      "5": header5Icon,
      "6": header6Icon
    },
    italic: italicIcon,
    image: imageIcon,
    indent: {
      "+1": indentIcon,
      "-1": outdentIcon
    },
    link: linkIcon,
    list: {
      bullet: listBulletIcon,
      check: listCheckIcon,
      ordered: listOrderedIcon
    },
    script: {
      sub: subscriptIcon,
      super: superscriptIcon
    },
    strike: strikeIcon,
    table: tableIcon,
    underline: underlineIcon,
    video: videoIcon
  };

  // node_modules/quill/ui/picker.js
  var DropdownIcon = '<svg viewbox="0 0 18 18"><polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"/><polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"/></svg>';
  var optionsCounter = 0;
  function toggleAriaAttribute(element, attribute) {
    element.setAttribute(attribute, `${!(element.getAttribute(attribute) === "true")}`);
  }
  var Picker = class {
    constructor(select) {
      this.select = select;
      this.container = document.createElement("span");
      this.buildPicker();
      this.select.style.display = "none";
      this.select.parentNode.insertBefore(this.container, this.select);
      this.label.addEventListener("mousedown", () => {
        this.togglePicker();
      });
      this.label.addEventListener("keydown", (event) => {
        switch (event.key) {
          case "Enter":
            this.togglePicker();
            break;
          case "Escape":
            this.escape();
            event.preventDefault();
            break;
          default:
        }
      });
      this.select.addEventListener("change", this.update.bind(this));
    }
    togglePicker() {
      this.container.classList.toggle("ql-expanded");
      toggleAriaAttribute(this.label, "aria-expanded");
      toggleAriaAttribute(this.options, "aria-hidden");
    }
    buildItem(option) {
      const item = document.createElement("span");
      item.tabIndex = "0";
      item.setAttribute("role", "button");
      item.classList.add("ql-picker-item");
      const value = option.getAttribute("value");
      if (value) {
        item.setAttribute("data-value", value);
      }
      if (option.textContent) {
        item.setAttribute("data-label", option.textContent);
      }
      item.addEventListener("click", () => {
        this.selectItem(item, true);
      });
      item.addEventListener("keydown", (event) => {
        switch (event.key) {
          case "Enter":
            this.selectItem(item, true);
            event.preventDefault();
            break;
          case "Escape":
            this.escape();
            event.preventDefault();
            break;
          default:
        }
      });
      return item;
    }
    buildLabel() {
      const label = document.createElement("span");
      label.classList.add("ql-picker-label");
      label.innerHTML = DropdownIcon;
      label.tabIndex = "0";
      label.setAttribute("role", "button");
      label.setAttribute("aria-expanded", "false");
      this.container.appendChild(label);
      return label;
    }
    buildOptions() {
      const options = document.createElement("span");
      options.classList.add("ql-picker-options");
      options.setAttribute("aria-hidden", "true");
      options.tabIndex = "-1";
      options.id = `ql-picker-options-${optionsCounter}`;
      optionsCounter += 1;
      this.label.setAttribute("aria-controls", options.id);
      this.options = options;
      Array.from(this.select.options).forEach((option) => {
        const item = this.buildItem(option);
        options.appendChild(item);
        if (option.selected === true) {
          this.selectItem(item);
        }
      });
      this.container.appendChild(options);
    }
    buildPicker() {
      Array.from(this.select.attributes).forEach((item) => {
        this.container.setAttribute(item.name, item.value);
      });
      this.container.classList.add("ql-picker");
      this.label = this.buildLabel();
      this.buildOptions();
    }
    escape() {
      this.close();
      setTimeout(() => this.label.focus(), 1);
    }
    close() {
      this.container.classList.remove("ql-expanded");
      this.label.setAttribute("aria-expanded", "false");
      this.options.setAttribute("aria-hidden", "true");
    }
    selectItem(item) {
      let trigger = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
      const selected = this.container.querySelector(".ql-selected");
      if (item === selected)
        return;
      if (selected != null) {
        selected.classList.remove("ql-selected");
      }
      if (item == null)
        return;
      item.classList.add("ql-selected");
      this.select.selectedIndex = Array.from(item.parentNode.children).indexOf(item);
      if (item.hasAttribute("data-value")) {
        this.label.setAttribute("data-value", item.getAttribute("data-value"));
      } else {
        this.label.removeAttribute("data-value");
      }
      if (item.hasAttribute("data-label")) {
        this.label.setAttribute("data-label", item.getAttribute("data-label"));
      } else {
        this.label.removeAttribute("data-label");
      }
      if (trigger) {
        this.select.dispatchEvent(new Event("change"));
        this.close();
      }
    }
    update() {
      let option;
      if (this.select.selectedIndex > -1) {
        const item = (
          // @ts-expect-error Fix me later
          this.container.querySelector(".ql-picker-options").children[this.select.selectedIndex]
        );
        option = this.select.options[this.select.selectedIndex];
        this.selectItem(item);
      } else {
        this.selectItem(null);
      }
      const isActive = option != null && option !== this.select.querySelector("option[selected]");
      this.label.classList.toggle("ql-active", isActive);
    }
  };
  var picker_default = Picker;

  // node_modules/quill/ui/color-picker.js
  var ColorPicker = class extends picker_default {
    constructor(select, label) {
      super(select);
      this.label.innerHTML = label;
      this.container.classList.add("ql-color-picker");
      Array.from(this.container.querySelectorAll(".ql-picker-item")).slice(0, 7).forEach((item) => {
        item.classList.add("ql-primary");
      });
    }
    buildItem(option) {
      const item = super.buildItem(option);
      item.style.backgroundColor = option.getAttribute("value") || "";
      return item;
    }
    selectItem(item, trigger) {
      super.selectItem(item, trigger);
      const colorLabel = this.label.querySelector(".ql-color-label");
      const value = item ? item.getAttribute("data-value") || "" : "";
      if (colorLabel) {
        if (colorLabel.tagName === "line") {
          colorLabel.style.stroke = value;
        } else {
          colorLabel.style.fill = value;
        }
      }
    }
  };
  var color_picker_default = ColorPicker;

  // node_modules/quill/ui/icon-picker.js
  var IconPicker = class extends picker_default {
    constructor(select, icons) {
      super(select);
      this.container.classList.add("ql-icon-picker");
      Array.from(this.container.querySelectorAll(".ql-picker-item")).forEach((item) => {
        item.innerHTML = icons[item.getAttribute("data-value") || ""];
      });
      this.defaultItem = this.container.querySelector(".ql-selected");
      this.selectItem(this.defaultItem);
    }
    selectItem(target, trigger) {
      super.selectItem(target, trigger);
      const item = target || this.defaultItem;
      if (item != null) {
        if (this.label.innerHTML === item.innerHTML)
          return;
        this.label.innerHTML = item.innerHTML;
      }
    }
  };
  var icon_picker_default = IconPicker;

  // node_modules/quill/ui/tooltip.js
  var isScrollable = (el) => {
    const {
      overflowY
    } = getComputedStyle(el, null);
    return overflowY !== "visible" && overflowY !== "clip";
  };
  var Tooltip = class {
    constructor(quill, boundsContainer) {
      this.quill = quill;
      this.boundsContainer = boundsContainer || document.body;
      this.root = quill.addContainer("ql-tooltip");
      this.root.innerHTML = this.constructor.TEMPLATE;
      if (isScrollable(this.quill.root)) {
        this.quill.root.addEventListener("scroll", () => {
          this.root.style.marginTop = `${-1 * this.quill.root.scrollTop}px`;
        });
      }
      this.hide();
    }
    hide() {
      this.root.classList.add("ql-hidden");
    }
    position(reference) {
      const left = reference.left + reference.width / 2 - this.root.offsetWidth / 2;
      const top = reference.bottom + this.quill.root.scrollTop;
      this.root.style.left = `${left}px`;
      this.root.style.top = `${top}px`;
      this.root.classList.remove("ql-flip");
      const containerBounds = this.boundsContainer.getBoundingClientRect();
      const rootBounds = this.root.getBoundingClientRect();
      let shift = 0;
      if (rootBounds.right > containerBounds.right) {
        shift = containerBounds.right - rootBounds.right;
        this.root.style.left = `${left + shift}px`;
      }
      if (rootBounds.left < containerBounds.left) {
        shift = containerBounds.left - rootBounds.left;
        this.root.style.left = `${left + shift}px`;
      }
      if (rootBounds.bottom > containerBounds.bottom) {
        const height = rootBounds.bottom - rootBounds.top;
        const verticalShift = reference.bottom - reference.top + height;
        this.root.style.top = `${top - verticalShift}px`;
        this.root.classList.add("ql-flip");
      }
      return shift;
    }
    show() {
      this.root.classList.remove("ql-editing");
      this.root.classList.remove("ql-hidden");
    }
  };
  var tooltip_default = Tooltip;

  // node_modules/quill/themes/base.js
  var ALIGNS = [false, "center", "right", "justify"];
  var COLORS = ["#000000", "#e60000", "#ff9900", "#ffff00", "#008a00", "#0066cc", "#9933ff", "#ffffff", "#facccc", "#ffebcc", "#ffffcc", "#cce8cc", "#cce0f5", "#ebd6ff", "#bbbbbb", "#f06666", "#ffc266", "#ffff66", "#66b966", "#66a3e0", "#c285ff", "#888888", "#a10000", "#b26b00", "#b2b200", "#006100", "#0047b2", "#6b24b2", "#444444", "#5c0000", "#663d00", "#666600", "#003700", "#002966", "#3d1466"];
  var FONTS = [false, "serif", "monospace"];
  var HEADERS = ["1", "2", "3", false];
  var SIZES = ["small", false, "large", "huge"];
  var BaseTheme = class extends theme_default {
    constructor(quill, options) {
      super(quill, options);
      const listener = (e) => {
        if (!document.body.contains(quill.root)) {
          document.body.removeEventListener("click", listener);
          return;
        }
        if (this.tooltip != null && // @ts-expect-error
        !this.tooltip.root.contains(e.target) && // @ts-expect-error
        document.activeElement !== this.tooltip.textbox && !this.quill.hasFocus()) {
          this.tooltip.hide();
        }
        if (this.pickers != null) {
          this.pickers.forEach((picker) => {
            if (!picker.container.contains(e.target)) {
              picker.close();
            }
          });
        }
      };
      quill.emitter.listenDOM("click", document.body, listener);
    }
    addModule(name) {
      const module2 = super.addModule(name);
      if (name === "toolbar") {
        this.extendToolbar(module2);
      }
      return module2;
    }
    buildButtons(buttons, icons) {
      Array.from(buttons).forEach((button) => {
        const className = button.getAttribute("class") || "";
        className.split(/\s+/).forEach((name) => {
          if (!name.startsWith("ql-"))
            return;
          name = name.slice("ql-".length);
          if (icons[name] == null)
            return;
          if (name === "direction") {
            button.innerHTML = icons[name][""] + icons[name].rtl;
          } else if (typeof icons[name] === "string") {
            button.innerHTML = icons[name];
          } else {
            const value = button.value || "";
            if (value != null && icons[name][value]) {
              button.innerHTML = icons[name][value];
            }
          }
        });
      });
    }
    buildPickers(selects, icons) {
      this.pickers = Array.from(selects).map((select) => {
        if (select.classList.contains("ql-align")) {
          if (select.querySelector("option") == null) {
            fillSelect(select, ALIGNS);
          }
          if (typeof icons.align === "object") {
            return new icon_picker_default(select, icons.align);
          }
        }
        if (select.classList.contains("ql-background") || select.classList.contains("ql-color")) {
          const format = select.classList.contains("ql-background") ? "background" : "color";
          if (select.querySelector("option") == null) {
            fillSelect(select, COLORS, format === "background" ? "#ffffff" : "#000000");
          }
          return new color_picker_default(select, icons[format]);
        }
        if (select.querySelector("option") == null) {
          if (select.classList.contains("ql-font")) {
            fillSelect(select, FONTS);
          } else if (select.classList.contains("ql-header")) {
            fillSelect(select, HEADERS);
          } else if (select.classList.contains("ql-size")) {
            fillSelect(select, SIZES);
          }
        }
        return new picker_default(select);
      });
      const update = () => {
        this.pickers.forEach((picker) => {
          picker.update();
        });
      };
      this.quill.on(emitter_default.events.EDITOR_CHANGE, update);
    }
  };
  BaseTheme.DEFAULTS = merge_default({}, theme_default.DEFAULTS, {
    modules: {
      toolbar: {
        handlers: {
          formula() {
            this.quill.theme.tooltip.edit("formula");
          },
          image() {
            let fileInput = this.container.querySelector("input.ql-image[type=file]");
            if (fileInput == null) {
              fileInput = document.createElement("input");
              fileInput.setAttribute("type", "file");
              fileInput.setAttribute("accept", this.quill.uploader.options.mimetypes.join(", "));
              fileInput.classList.add("ql-image");
              fileInput.addEventListener("change", () => {
                const range = this.quill.getSelection(true);
                this.quill.uploader.upload(range, fileInput.files);
                fileInput.value = "";
              });
              this.container.appendChild(fileInput);
            }
            fileInput.click();
          },
          video() {
            this.quill.theme.tooltip.edit("video");
          }
        }
      }
    }
  });
  var BaseTooltip = class extends tooltip_default {
    constructor(quill, boundsContainer) {
      super(quill, boundsContainer);
      this.textbox = this.root.querySelector('input[type="text"]');
      this.listen();
    }
    listen() {
      this.textbox.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          this.save();
          event.preventDefault();
        } else if (event.key === "Escape") {
          this.cancel();
          event.preventDefault();
        }
      });
    }
    cancel() {
      this.hide();
      this.restoreFocus();
    }
    edit() {
      let mode = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "link";
      let preview = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : null;
      this.root.classList.remove("ql-hidden");
      this.root.classList.add("ql-editing");
      if (this.textbox == null)
        return;
      if (preview != null) {
        this.textbox.value = preview;
      } else if (mode !== this.root.getAttribute("data-mode")) {
        this.textbox.value = "";
      }
      const bounds = this.quill.getBounds(this.quill.selection.savedRange);
      if (bounds != null) {
        this.position(bounds);
      }
      this.textbox.select();
      this.textbox.setAttribute("placeholder", this.textbox.getAttribute(`data-${mode}`) || "");
      this.root.setAttribute("data-mode", mode);
    }
    restoreFocus() {
      this.quill.focus({
        preventScroll: true
      });
    }
    save() {
      let {
        value
      } = this.textbox;
      switch (this.root.getAttribute("data-mode")) {
        case "link": {
          const {
            scrollTop
          } = this.quill.root;
          if (this.linkRange) {
            this.quill.formatText(this.linkRange, "link", value, emitter_default.sources.USER);
            delete this.linkRange;
          } else {
            this.restoreFocus();
            this.quill.format("link", value, emitter_default.sources.USER);
          }
          this.quill.root.scrollTop = scrollTop;
          break;
        }
        case "video": {
          value = extractVideoUrl(value);
        }
        case "formula": {
          if (!value)
            break;
          const range = this.quill.getSelection(true);
          if (range != null) {
            const index = range.index + range.length;
            this.quill.insertEmbed(
              index,
              // @ts-expect-error Fix me later
              this.root.getAttribute("data-mode"),
              value,
              emitter_default.sources.USER
            );
            if (this.root.getAttribute("data-mode") === "formula") {
              this.quill.insertText(index + 1, " ", emitter_default.sources.USER);
            }
            this.quill.setSelection(index + 2, emitter_default.sources.USER);
          }
          break;
        }
        default:
      }
      this.textbox.value = "";
      this.hide();
    }
  };
  function extractVideoUrl(url) {
    let match2 = url.match(/^(?:(https?):\/\/)?(?:(?:www|m)\.)?youtube\.com\/watch.*v=([a-zA-Z0-9_-]+)/) || url.match(/^(?:(https?):\/\/)?(?:(?:www|m)\.)?youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (match2) {
      return `${match2[1] || "https"}://www.youtube.com/embed/${match2[2]}?showinfo=0`;
    }
    if (match2 = url.match(/^(?:(https?):\/\/)?(?:www\.)?vimeo\.com\/(\d+)/)) {
      return `${match2[1] || "https"}://player.vimeo.com/video/${match2[2]}/`;
    }
    return url;
  }
  function fillSelect(select, values) {
    let defaultValue = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : false;
    values.forEach((value) => {
      const option = document.createElement("option");
      if (value === defaultValue) {
        option.setAttribute("selected", "selected");
      } else {
        option.setAttribute("value", String(value));
      }
      select.appendChild(option);
    });
  }

  // node_modules/quill/themes/bubble.js
  var TOOLBAR_CONFIG = [["bold", "italic", "link"], [{
    header: 1
  }, {
    header: 2
  }, "blockquote"]];
  var BubbleTooltip = class extends BaseTooltip {
    static TEMPLATE = ['<span class="ql-tooltip-arrow"></span>', '<div class="ql-tooltip-editor">', '<input type="text" data-formula="e=mc^2" data-link="https://quilljs.com" data-video="Embed URL">', '<a class="ql-close"></a>', "</div>"].join("");
    constructor(quill, bounds) {
      super(quill, bounds);
      this.quill.on(emitter_default.events.EDITOR_CHANGE, (type, range, oldRange, source) => {
        if (type !== emitter_default.events.SELECTION_CHANGE)
          return;
        if (range != null && range.length > 0 && source === emitter_default.sources.USER) {
          this.show();
          this.root.style.left = "0px";
          this.root.style.width = "";
          this.root.style.width = `${this.root.offsetWidth}px`;
          const lines = this.quill.getLines(range.index, range.length);
          if (lines.length === 1) {
            const bounds2 = this.quill.getBounds(range);
            if (bounds2 != null) {
              this.position(bounds2);
            }
          } else {
            const lastLine = lines[lines.length - 1];
            const index = this.quill.getIndex(lastLine);
            const length = Math.min(lastLine.length() - 1, range.index + range.length - index);
            const indexBounds = this.quill.getBounds(new Range(index, length));
            if (indexBounds != null) {
              this.position(indexBounds);
            }
          }
        } else if (document.activeElement !== this.textbox && this.quill.hasFocus()) {
          this.hide();
        }
      });
    }
    listen() {
      super.listen();
      this.root.querySelector(".ql-close").addEventListener("click", () => {
        this.root.classList.remove("ql-editing");
      });
      this.quill.on(emitter_default.events.SCROLL_OPTIMIZE, () => {
        setTimeout(() => {
          if (this.root.classList.contains("ql-hidden"))
            return;
          const range = this.quill.getSelection();
          if (range != null) {
            const bounds = this.quill.getBounds(range);
            if (bounds != null) {
              this.position(bounds);
            }
          }
        }, 1);
      });
    }
    cancel() {
      this.show();
    }
    position(reference) {
      const shift = super.position(reference);
      const arrow = this.root.querySelector(".ql-tooltip-arrow");
      arrow.style.marginLeft = "";
      if (shift !== 0) {
        arrow.style.marginLeft = `${-1 * shift - arrow.offsetWidth / 2}px`;
      }
      return shift;
    }
  };
  var BubbleTheme = class extends BaseTheme {
    constructor(quill, options) {
      if (options.modules.toolbar != null && options.modules.toolbar.container == null) {
        options.modules.toolbar.container = TOOLBAR_CONFIG;
      }
      super(quill, options);
      this.quill.container.classList.add("ql-bubble");
    }
    extendToolbar(toolbar) {
      this.tooltip = new BubbleTooltip(this.quill, this.options.bounds);
      if (toolbar.container != null) {
        this.tooltip.root.appendChild(toolbar.container);
        this.buildButtons(toolbar.container.querySelectorAll("button"), icons_default);
        this.buildPickers(toolbar.container.querySelectorAll("select"), icons_default);
      }
    }
  };
  BubbleTheme.DEFAULTS = merge_default({}, BaseTheme.DEFAULTS, {
    modules: {
      toolbar: {
        handlers: {
          link(value) {
            if (!value) {
              this.quill.format("link", false, Quill.sources.USER);
            } else {
              this.quill.theme.tooltip.edit();
            }
          }
        }
      }
    }
  });

  // node_modules/quill/themes/snow.js
  var TOOLBAR_CONFIG2 = [[{
    header: ["1", "2", "3", false]
  }], ["bold", "italic", "underline", "link"], [{
    list: "ordered"
  }, {
    list: "bullet"
  }], ["clean"]];
  var SnowTooltip = class extends BaseTooltip {
    static TEMPLATE = ['<a class="ql-preview" rel="noopener noreferrer" target="_blank" href="about:blank"></a>', '<input type="text" data-formula="e=mc^2" data-link="https://quilljs.com" data-video="Embed URL">', '<a class="ql-action"></a>', '<a class="ql-remove"></a>'].join("");
    preview = this.root.querySelector("a.ql-preview");
    listen() {
      super.listen();
      this.root.querySelector("a.ql-action").addEventListener("click", (event) => {
        if (this.root.classList.contains("ql-editing")) {
          this.save();
        } else {
          this.edit("link", this.preview.textContent);
        }
        event.preventDefault();
      });
      this.root.querySelector("a.ql-remove").addEventListener("click", (event) => {
        if (this.linkRange != null) {
          const range = this.linkRange;
          this.restoreFocus();
          this.quill.formatText(range, "link", false, emitter_default.sources.USER);
          delete this.linkRange;
        }
        event.preventDefault();
        this.hide();
      });
      this.quill.on(emitter_default.events.SELECTION_CHANGE, (range, oldRange, source) => {
        if (range == null)
          return;
        if (range.length === 0 && source === emitter_default.sources.USER) {
          const [link, offset] = this.quill.scroll.descendant(Link, range.index);
          if (link != null) {
            this.linkRange = new Range(range.index - offset, link.length());
            const preview = Link.formats(link.domNode);
            this.preview.textContent = preview;
            this.preview.setAttribute("href", preview);
            this.show();
            const bounds = this.quill.getBounds(this.linkRange);
            if (bounds != null) {
              this.position(bounds);
            }
            return;
          }
        } else {
          delete this.linkRange;
        }
        this.hide();
      });
    }
    show() {
      super.show();
      this.root.removeAttribute("data-mode");
    }
  };
  var SnowTheme = class extends BaseTheme {
    constructor(quill, options) {
      if (options.modules.toolbar != null && options.modules.toolbar.container == null) {
        options.modules.toolbar.container = TOOLBAR_CONFIG2;
      }
      super(quill, options);
      this.quill.container.classList.add("ql-snow");
    }
    extendToolbar(toolbar) {
      if (toolbar.container != null) {
        toolbar.container.classList.add("ql-snow");
        this.buildButtons(toolbar.container.querySelectorAll("button"), icons_default);
        this.buildPickers(toolbar.container.querySelectorAll("select"), icons_default);
        this.tooltip = new SnowTooltip(this.quill, this.options.bounds);
        if (toolbar.container.querySelector(".ql-link")) {
          this.quill.keyboard.addBinding({
            key: "k",
            shortKey: true
          }, (_range, context) => {
            toolbar.handlers.link.call(toolbar, !context.format.link);
          });
        }
      }
    }
  };
  SnowTheme.DEFAULTS = merge_default({}, BaseTheme.DEFAULTS, {
    modules: {
      toolbar: {
        handlers: {
          link(value) {
            if (value) {
              const range = this.quill.getSelection();
              if (range == null || range.length === 0)
                return;
              let preview = this.quill.getText(range);
              if (/^\S+@\S+\.\S+$/.test(preview) && preview.indexOf("mailto:") !== 0) {
                preview = `mailto:${preview}`;
              }
              const {
                tooltip
              } = this.quill.theme;
              tooltip.edit("link", preview);
            } else {
              this.quill.format("link", false, Quill.sources.USER);
            }
          }
        }
      }
    }
  });
  var snow_default = SnowTheme;

  // node_modules/quill/quill.js
  core_default.register({
    "attributors/attribute/direction": DirectionAttribute,
    "attributors/class/align": AlignClass,
    "attributors/class/background": BackgroundClass,
    "attributors/class/color": ColorClass,
    "attributors/class/direction": DirectionClass,
    "attributors/class/font": FontClass,
    "attributors/class/size": SizeClass,
    "attributors/style/align": AlignStyle,
    "attributors/style/background": BackgroundStyle,
    "attributors/style/color": ColorStyle,
    "attributors/style/direction": DirectionStyle,
    "attributors/style/font": FontStyle,
    "attributors/style/size": SizeStyle
  }, true);
  core_default.register({
    "formats/align": AlignClass,
    "formats/direction": DirectionClass,
    "formats/indent": indent_default,
    "formats/background": BackgroundStyle,
    "formats/color": ColorStyle,
    "formats/font": FontClass,
    "formats/size": SizeClass,
    "formats/blockquote": blockquote_default,
    "formats/code-block": CodeBlock,
    "formats/header": header_default,
    "formats/list": ListItem,
    "formats/bold": bold_default,
    "formats/code": Code,
    "formats/italic": italic_default,
    "formats/link": Link,
    "formats/script": script_default,
    "formats/strike": strike_default,
    "formats/underline": underline_default,
    "formats/formula": formula_default,
    "formats/image": image_default,
    "formats/video": video_default,
    "modules/syntax": Syntax,
    "modules/table": table_default,
    "modules/toolbar": Toolbar,
    "themes/bubble": BubbleTheme,
    "themes/snow": snow_default,
    "ui/icons": icons_default,
    "ui/picker": picker_default,
    "ui/icon-picker": icon_picker_default,
    "ui/color-picker": color_picker_default,
    "ui/tooltip": tooltip_default
  }, true);
  var quill_default = core_default;

  // src/colors.js
  var DEFAULT_COLOR_PALETTE = [
    "#000000",
    "#434343",
    "#666666",
    "#999999",
    "#cccccc",
    "#ffffff",
    "#e60000",
    "#ff9900",
    "#ffff00",
    "#008a00",
    "#0066cc",
    "#9933ff",
    "#ff99cc",
    "#ffcc99",
    "#ffff99",
    "#99ff99",
    "#99ccff",
    "#cc99ff"
  ];
  function getColorPalette() {
    if (window._quarto_brand_palette && Array.isArray(window._quarto_brand_palette) && window._quarto_brand_palette.length > 0) {
      return window._quarto_brand_palette;
    }
    return DEFAULT_COLOR_PALETTE;
  }
  function rgbToHex(rgb) {
    const match2 = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match2)
      return null;
    const r = parseInt(match2[1], 10);
    const g = parseInt(match2[2], 10);
    const b = parseInt(match2[3], 10);
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function normalizeColor(color) {
    if (!color)
      return color;
    let normalized = color.trim().toLowerCase();
    if (normalized.startsWith("rgb")) {
      const hex = rgbToHex(normalized);
      if (hex)
        return hex.toLowerCase();
    }
    const namedColors = {
      black: "#000000",
      white: "#ffffff",
      red: "#ff0000",
      lime: "#00ff00",
      blue: "#0000ff",
      yellow: "#ffff00",
      cyan: "#00ffff",
      magenta: "#ff00ff",
      silver: "#c0c0c0",
      gray: "#808080",
      grey: "#808080",
      maroon: "#800000",
      olive: "#808000",
      green: "#008000",
      purple: "#800080",
      teal: "#008080",
      navy: "#000080",
      orange: "#ffa500",
      transparent: "#00000000"
    };
    if (namedColors[normalized])
      return namedColors[normalized];
    if (normalized.match(/^#[0-9a-f]{3}$/i)) {
      return "#" + normalized[1] + normalized[1] + normalized[2] + normalized[2] + normalized[3] + normalized[3];
    }
    return normalized;
  }
  function getBrandColorOutput(colorVal) {
    if (!window._quarto_brand_color_names) {
      return colorVal;
    }
    let normalizedColor = colorVal.toLowerCase().trim();
    if (normalizedColor.startsWith("rgb")) {
      const hexColor = rgbToHex(normalizedColor);
      if (hexColor) {
        normalizedColor = hexColor.toLowerCase();
      }
    }
    const brandName = window._quarto_brand_color_names[normalizedColor];
    if (brandName) {
      return `__BRAND_SHORTCODE_${brandName}__`;
    }
    return colorVal;
  }

  // src/quill.js
  var quillInstances = /* @__PURE__ */ new Map();
  function initializeQuillForElement(element) {
    const tag = element.tagName.toLowerCase();
    if (tag !== "div" && tag !== "p")
      return null;
    if (quillInstances.has(element))
      return quillInstances.get(element);
    try {
      let createColorHandler = function(picker, formatName) {
        return function(value) {
          if (value === "unset") {
            this.quill.format(formatName, false);
          } else if (value === "custom") {
            const range = this.quill.getSelection();
            picker.click();
            picker.onchange = () => {
              if (range) {
                this.quill.setSelection(range);
              }
              this.quill.format(formatName, picker.value);
            };
          } else {
            this.quill.format(formatName, value);
          }
        };
      };
      const originalContent = element.innerHTML;
      element.innerHTML = "";
      const presetColors = getColorPalette();
      const colorOptions = presetColors.map((c) => `<option value="${c}"></option>`).join("");
      const colorOptionsWithExtras = `<option value="unset"></option>` + colorOptions + `<option value="custom">\u22EF</option>`;
      const toolbarContainer = document.createElement("div");
      toolbarContainer.id = "toolbar-" + Math.random().toString(36).substring(2, 11);
      toolbarContainer.innerHTML = `
      <button class="ql-bold" aria-label="Bold">B</button>
      <button class="ql-italic" aria-label="Italic">I</button>
      <button class="ql-underline" aria-label="Underline">U</button>
      <button class="ql-strike" aria-label="Strikethrough">S</button>
      <span class="quill-toolbar-separator"></span>
      <select class="ql-color" aria-label="Text color">${colorOptionsWithExtras}</select>
      <select class="ql-background" aria-label="Background color">${colorOptionsWithExtras}</select>
      <span class="quill-toolbar-separator"></span>
      <button class="ql-align" value="" aria-label="Align left"></button>
      <button class="ql-align" value="center" aria-label="Align center"></button>
      <button class="ql-align" value="right" aria-label="Align right"></button>
    `;
      element.appendChild(toolbarContainer);
      const textColorPicker = document.createElement("input");
      textColorPicker.type = "color";
      textColorPicker.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
      element.appendChild(textColorPicker);
      const bgColorPicker = document.createElement("input");
      bgColorPicker.type = "color";
      bgColorPicker.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
      element.appendChild(bgColorPicker);
      const editorWrapper = document.createElement("div");
      editorWrapper.className = "quill-wrapper";
      editorWrapper.innerHTML = originalContent;
      element.appendChild(editorWrapper);
      const quill = new quill_default(editorWrapper, {
        theme: "snow",
        modules: {
          toolbar: {
            container: "#" + toolbarContainer.id,
            handlers: {
              color: createColorHandler(textColorPicker, "color"),
              background: createColorHandler(bgColorPicker, "background")
            }
          }
        },
        placeholder: ""
      });
      toolbarContainer.className = "quill-toolbar-container ql-toolbar ql-snow";
      toolbarContainer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      quill.enable(false);
      const quillData = {
        quill,
        toolbarContainer,
        editorWrapper,
        isEditing: false,
        originalContent,
        // Preserve for unedited divs
        isDirty: false
        // Track if content was modified
      };
      quill.on("text-change", () => {
        quillData.isDirty = true;
      });
      quillInstances.set(element, quillData);
      return quillData;
    } catch (err) {
      console.error("Failed to initialize Quill for element:", err);
      return null;
    }
  }

  // src/selection.js
  var deselectImageFn = null;
  var deselectArrowFn = null;
  function registerDeselectImage(fn) {
    deselectImageFn = fn;
  }
  function registerDeselectArrow(fn) {
    deselectArrowFn = fn;
  }
  function deselectImage() {
    if (deselectImageFn)
      deselectImageFn();
  }
  function deselectArrow() {
    if (deselectArrowFn)
      deselectArrowFn();
  }

  // src/arrows.js
  var arrowExtensionWarningShown = false;
  function hasArrowExtension() {
    if (window._quarto_arrow_extension)
      return true;
    const arrowSvgs = document.querySelectorAll('svg defs marker[id^="arrow-"]');
    if (arrowSvgs.length > 0)
      return true;
    const arrowPaths = document.querySelectorAll('svg path[marker-end^="url(#arrow-"]');
    if (arrowPaths.length > 0)
      return true;
    return false;
  }
  function showArrowExtensionModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "editable-modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "editable-modal-title");
      const modal = document.createElement("div");
      modal.className = "editable-modal";
      const title = document.createElement("h3");
      title.id = "editable-modal-title";
      title.className = "editable-modal-title";
      title.textContent = "Arrow Extension Required";
      const p1 = document.createElement("p");
      p1.className = "editable-modal-body";
      p1.innerHTML = 'Arrows are saved as <code class="editable-modal-code">{{&lt; arrow &gt;}}</code> shortcodes which require the <a href="https://github.com/EmilHvitfeldt/quarto-arrows" target="_blank" class="editable-modal-link">quarto-arrows</a> extension to render.';
      const p2 = document.createElement("p");
      p2.className = "editable-modal-body";
      const installCode = document.createElement("code");
      installCode.className = "editable-modal-code editable-modal-code-block";
      installCode.textContent = "quarto add EmilHvitfeldt/quarto-arrows";
      p2.appendChild(document.createTextNode("Install with:"));
      p2.appendChild(document.createElement("br"));
      p2.appendChild(installCode);
      const p3 = document.createElement("p");
      p3.className = "editable-modal-body editable-modal-body-small";
      p3.textContent = "Continue? (Arrows will work in the editor but won't render until the extension is installed)";
      const btnRow = document.createElement("div");
      btnRow.className = "editable-modal-buttons";
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "editable-modal-cancel";
      cancelBtn.textContent = "Cancel";
      const confirmBtn = document.createElement("button");
      confirmBtn.className = "editable-modal-confirm";
      confirmBtn.textContent = "Continue";
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(confirmBtn);
      modal.appendChild(title);
      modal.appendChild(p1);
      modal.appendChild(p2);
      modal.appendChild(p3);
      modal.appendChild(btnRow);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      const cleanup = (result) => {
        overlay.remove();
        resolve(result);
      };
      cancelBtn.onclick = () => cleanup(false);
      confirmBtn.onclick = () => cleanup(true);
      overlay.onclick = (e) => {
        if (e.target === overlay)
          cleanup(false);
      };
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          cleanup(false);
          return;
        }
        if (e.key !== "Tab")
          return;
        const focusable = [...modal.querySelectorAll("button, a, [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length)
          return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
      confirmBtn.focus();
    });
  }
  async function showArrowExtensionWarning() {
    if (arrowExtensionWarningShown)
      return true;
    const detected = hasArrowExtension();
    if (detected) {
      arrowExtensionWarningShown = true;
      return true;
    }
    const confirmed = await showArrowExtensionModal();
    if (confirmed) {
      arrowExtensionWarningShown = true;
    }
    return confirmed;
  }
  var activeArrow = null;
  var globalClickOutsideHandlerRegistered = false;
  var arrowControlRefs = {
    colorPicker: null,
    widthInput: null,
    headSelect: null,
    dashSelect: null,
    lineSelect: null,
    opacityInput: null,
    colorPresetsRow: null,
    labelInput: null,
    labelPositionSelect: null,
    labelOffsetInput: null,
    smoothToggle: null,
    waypointBadge: null,
    curveToggle: null
  };
  function syncOpacitySliderColor(color) {
    const el = arrowControlRefs.opacityInput;
    if (el)
      el.style.setProperty("--arrow-opacity-color", color);
  }
  registerDeselectArrow(() => setActiveArrow(null));
  function initArrows() {
    registerRestoreArrowDOM((snapshots) => {
      for (const snapshot of snapshots) {
        updateArrowPath(snapshot.arrowData);
        updateArrowHandles(snapshot.arrowData);
        updateArrowAppearance(snapshot.arrowData);
        updateArrowActiveState(snapshot.arrowData);
      }
    });
  }
  function setActiveArrow(arrowData) {
    if (activeArrow && activeArrow !== arrowData) {
      activeArrow.isActive = false;
      updateArrowActiveState(activeArrow);
    }
    if (arrowData && arrowData !== activeArrow) {
      deselectImage();
    }
    activeArrow = arrowData;
    if (arrowData) {
      arrowData.isActive = true;
      updateArrowActiveState(arrowData);
    }
    updateArrowStylePanel(arrowData);
  }
  function getActiveArrow() {
    return activeArrow;
  }
  function createArrowStyleControls() {
    const container = document.createElement("div");
    container.className = "arrow-style-controls";
    function openPopoverBelow(popover, anchor) {
      const rect = anchor.getBoundingClientRect();
      popover.style.top = rect.bottom + 4 + "px";
      popover.style.left = rect.left + "px";
      popover.style.display = "";
    }
    function createNumberInput({ id, className, title, defaultValue, min, max, onUndo, onUpdate, updateFn }) {
      const input = document.createElement("input");
      input.type = "number";
      input.id = id;
      input.className = className;
      if (min !== void 0)
        input.min = min;
      if (max !== void 0)
        input.max = max;
      input.value = defaultValue.toString();
      input.title = title;
      let _undoPushed = false;
      input.addEventListener("focus", () => {
        _undoPushed = false;
        if (activeArrow && onUndo) {
          onUndo();
          _undoPushed = true;
        }
      });
      input.addEventListener("blur", () => {
        _undoPushed = false;
      });
      input.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (activeArrow) {
          if (onUndo)
            onUndo();
          const delta = e.deltaY < 0 ? 1 : -1;
          const raw = (parseInt(input.value) || 0) + delta;
          const clamped = min !== void 0 || max !== void 0 ? Math.max(min ?? -Infinity, Math.min(max ?? Infinity, raw)) : raw;
          input.value = clamped.toString();
          onUpdate(clamped);
          updateFn(activeArrow);
        }
      }, { passive: false });
      input.addEventListener("input", (e) => {
        if (activeArrow) {
          if (!_undoPushed && onUndo) {
            onUndo();
            _undoPushed = true;
          }
          const val = parseInt(e.target.value);
          if (!isNaN(val)) {
            const clamped = min !== void 0 || max !== void 0 ? Math.max(min ?? -Infinity, Math.min(max ?? Infinity, val)) : val;
            onUpdate(clamped);
            updateFn(activeArrow);
          }
        }
      });
      return input;
    }
    const colorSection = document.createElement("div");
    colorSection.className = "arrow-color-section";
    const colorPickerBtn = document.createElement("button");
    colorPickerBtn.className = "arrow-color-btn";
    colorPickerBtn.style.backgroundColor = "#000000";
    colorPickerBtn.title = "Custom color";
    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.id = "arrow-style-color";
    colorPicker.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
    colorPicker.value = "#000000";
    colorPickerBtn.appendChild(colorPicker);
    colorPickerBtn.addEventListener("click", () => colorPicker.click());
    let _colorUndoPushed = false;
    colorPicker.addEventListener("focus", () => {
      _colorUndoPushed = false;
      if (activeArrow) {
        pushUndoState();
        _colorUndoPushed = true;
      }
    });
    colorPicker.addEventListener("blur", () => {
      _colorUndoPushed = false;
    });
    colorPicker.addEventListener("input", (e) => {
      if (activeArrow) {
        if (!_colorUndoPushed) {
          pushUndoState();
          _colorUndoPushed = true;
        }
        activeArrow.color = e.target.value;
        updateArrowAppearance(activeArrow);
        colorPickerBtn.style.backgroundColor = e.target.value;
        syncOpacitySliderColor(e.target.value);
        colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach((s) => s.classList.remove("selected"));
      }
    });
    colorSection.appendChild(colorPickerBtn);
    const presetsToggleBtn = document.createElement("button");
    presetsToggleBtn.className = "arrow-color-btn arrow-color-presets-toggle";
    presetsToggleBtn.title = "Preset colors";
    colorSection.appendChild(presetsToggleBtn);
    const colorPresetsPopover = document.createElement("div");
    colorPresetsPopover.className = "arrow-color-presets-popover";
    colorPresetsPopover.style.display = "none";
    document.body.appendChild(colorPresetsPopover);
    const colorPresetsRow = document.createElement("div");
    colorPresetsRow.className = "arrow-color-presets";
    colorPresetsPopover.appendChild(colorPresetsRow);
    const defaultColors = ["#000000"];
    const paletteColors = getColorPalette();
    const allColors = [...defaultColors, ...paletteColors.filter((c) => c.toLowerCase() !== "#000000")];
    allColors.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.className = "arrow-color-swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.addEventListener("click", () => {
        if (activeArrow) {
          pushUndoState();
          activeArrow.color = color;
          updateArrowAppearance(activeArrow);
          colorPicker.value = color;
          colorPickerBtn.style.backgroundColor = color;
          syncOpacitySliderColor(color);
          colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach((s) => s.classList.remove("selected"));
          swatch.classList.add("selected");
          colorPresetsPopover.style.display = "none";
        }
      });
      colorPresetsRow.appendChild(swatch);
    });
    presetsToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = colorPresetsPopover.style.display !== "none";
      colorPresetsPopover.style.display = "none";
      if (!isOpen)
        openPopoverBelow(colorPresetsPopover, presetsToggleBtn);
    });
    colorPresetsPopover.addEventListener("mousedown", (e) => e.preventDefault());
    const centerWrap = document.createElement("div");
    centerWrap.className = "arrow-center-wrap";
    centerWrap.appendChild(colorSection);
    container.appendChild(centerWrap);
    const controlsWrap = document.createElement("div");
    controlsWrap.className = "arrow-controls-wrap";
    function createIconSelect(options, onChange) {
      const wrapper = document.createElement("div");
      wrapper.className = "arrow-icon-select";
      const btn = document.createElement("button");
      btn.className = "arrow-icon-select-btn";
      let currentValue = options[0].value;
      const dropdown = document.createElement("div");
      dropdown.className = "arrow-icon-select-dropdown";
      dropdown.style.display = "none";
      document.body.appendChild(dropdown);
      options.forEach(({ value, icon, title }) => {
        const item = document.createElement("button");
        item.className = "arrow-icon-select-item";
        item.dataset.value = value;
        item.innerHTML = `<span class="arrow-icon-select-icon">${icon}</span><span>${title}</span>`;
        item.addEventListener("mousedown", (e) => e.preventDefault());
        item.addEventListener("click", () => {
          if (activeArrow) {
            pushUndoState();
            onChange(value);
          }
          wrapper.value = value;
          dropdown.style.display = "none";
        });
        dropdown.appendChild(item);
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display !== "none";
        document.querySelectorAll(".arrow-icon-select-dropdown").forEach((d) => d.style.display = "none");
        if (!isOpen)
          openPopoverBelow(dropdown, btn);
      });
      wrapper.appendChild(btn);
      Object.defineProperty(wrapper, "value", {
        get() {
          return currentValue;
        },
        set(val) {
          currentValue = val;
          const opt = options.find((o) => o.value === val);
          if (opt)
            btn.innerHTML = opt.icon;
          dropdown.querySelectorAll(".arrow-icon-select-item").forEach((item) => {
            item.classList.toggle("active", item.dataset.value === val);
          });
        }
      });
      wrapper.value = options[0].value;
      return wrapper;
    }
    const widthInput = createNumberInput({
      id: "arrow-style-width",
      className: "arrow-toolbar-width",
      title: "Width",
      defaultValue: 2,
      min: 1,
      max: 20,
      onUndo: () => pushUndoState(),
      onUpdate: (val) => {
        activeArrow.width = val;
      },
      updateFn: updateArrowAppearance
    });
    controlsWrap.appendChild(widthInput);
    const headSelect = createIconSelect([
      { value: "arrow", icon: "\u2192", title: "Arrow" },
      { value: "stealth", icon: "\u25B6", title: "Stealth" },
      { value: "diamond", icon: "\u25C6", title: "Diamond" },
      { value: "circle", icon: "\u25CF", title: "Circle" },
      { value: "square", icon: "\u25A0", title: "Square" },
      { value: "bar", icon: "|", title: "Bar" },
      { value: "none", icon: "\u2715", title: "None" }
    ], (value) => {
      activeArrow.head = value;
      updateArrowAppearance(activeArrow);
    });
    headSelect.id = "arrow-style-head";
    headSelect.value = "arrow";
    controlsWrap.appendChild(headSelect);
    const dashSelect = createIconSelect([
      { value: "solid", icon: "\u2500", title: "Solid" },
      { value: "dashed", icon: "\u254C", title: "Dashed" },
      { value: "dotted", icon: "\xB7", title: "Dotted" }
    ], (value) => {
      activeArrow.dash = value;
      updateArrowAppearance(activeArrow);
    });
    dashSelect.id = "arrow-style-dash";
    dashSelect.value = "solid";
    controlsWrap.appendChild(dashSelect);
    const lineSelect = createIconSelect([
      { value: "single", icon: "\u2500", title: "Single" },
      { value: "double", icon: "\u2550", title: "Double" },
      { value: "triple", icon: "\u2261", title: "Triple" }
    ], (value) => {
      activeArrow.line = value;
      updateArrowAppearance(activeArrow);
    });
    lineSelect.id = "arrow-style-line";
    lineSelect.value = "single";
    controlsWrap.appendChild(lineSelect);
    const opacityInput = document.createElement("input");
    opacityInput.type = "range";
    opacityInput.id = "arrow-style-opacity";
    opacityInput.className = "arrow-toolbar-opacity";
    opacityInput.min = "0";
    opacityInput.max = "1";
    opacityInput.step = "0.1";
    opacityInput.value = "1";
    opacityInput.title = "Opacity";
    opacityInput.addEventListener("mousedown", () => {
      if (activeArrow)
        pushUndoState();
    });
    opacityInput.addEventListener("input", (e) => {
      if (activeArrow) {
        activeArrow.opacity = parseFloat(e.target.value);
        updateArrowAppearance(activeArrow);
      }
    });
    controlsWrap.appendChild(opacityInput);
    const curveToggle = document.createElement("button");
    curveToggle.id = "arrow-style-curve";
    curveToggle.className = "arrow-toolbar-curve arrow-toolbar-btn";
    curveToggle.innerHTML = "\u2934";
    curveToggle.title = "Toggle curve mode";
    curveToggle.addEventListener("click", () => {
      if (activeArrow) {
        pushUndoState();
        if (activeArrow.waypoints && activeArrow.waypoints.length > 0) {
          activeArrow.waypoints = [];
          activeArrow.smooth = false;
          rebuildWaypointHandles(activeArrow);
          updateSmoothToggleInToolbar(activeArrow);
        }
        toggleCurveMode(activeArrow);
        updateCurveToggleInToolbar(activeArrow);
      }
    });
    controlsWrap.appendChild(curveToggle);
    const smoothToggle = document.createElement("button");
    smoothToggle.id = "arrow-style-smooth";
    smoothToggle.className = "arrow-toolbar-smooth arrow-toolbar-btn";
    smoothToggle.innerHTML = "\u3030";
    smoothToggle.title = "Toggle smooth curves through waypoints";
    smoothToggle.addEventListener("click", () => {
      if (activeArrow && activeArrow.waypoints && activeArrow.waypoints.length > 0) {
        pushUndoState();
        activeArrow.smooth = !activeArrow.smooth;
        updateArrowPath(activeArrow);
        updateSmoothToggleInToolbar(activeArrow);
      }
    });
    const waypointBadge = document.createElement("span");
    waypointBadge.id = "arrow-style-waypoint-count";
    waypointBadge.className = "arrow-toolbar-waypoint-badge";
    waypointBadge.title = "Number of waypoints (double-click arrow to add, double-click waypoint to remove)";
    const labelSection = document.createElement("div");
    labelSection.className = "arrow-label-section";
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.id = "arrow-style-label";
    labelInput.className = "arrow-toolbar-label";
    labelInput.placeholder = "Label...";
    labelInput.title = "Label text";
    labelInput.addEventListener("input", (e) => {
      if (activeArrow) {
        activeArrow.label = e.target.value;
        updateArrowLabel(activeArrow);
      }
    });
    labelSection.appendChild(labelInput);
    const labelSubRow = document.createElement("div");
    labelSubRow.className = "arrow-label-subrow";
    const labelPositionSelect = createIconSelect([
      { value: "start", icon: "\u25C4", title: "Label at start" },
      { value: "middle", icon: "\u25C6", title: "Label at middle" },
      { value: "end", icon: "\u25BA", title: "Label at end" }
    ], (value) => {
      if (activeArrow) {
        activeArrow.labelPosition = value;
        updateArrowLabel(activeArrow);
      }
    });
    labelPositionSelect.id = "arrow-style-label-position";
    labelPositionSelect.value = CONFIG.ARROW_DEFAULT_LABEL_POSITION;
    labelSubRow.appendChild(labelPositionSelect);
    const labelOffsetInput = createNumberInput({
      id: "arrow-style-label-offset",
      className: "arrow-toolbar-width",
      title: "Label offset (positive = above, negative = below)",
      defaultValue: CONFIG.ARROW_DEFAULT_LABEL_OFFSET,
      onUpdate: (val) => {
        activeArrow.labelOffset = val;
      },
      updateFn: updateArrowLabel
    });
    labelSubRow.appendChild(labelOffsetInput);
    labelSection.appendChild(labelSubRow);
    controlsWrap.appendChild(labelSection);
    controlsWrap.appendChild(smoothToggle);
    controlsWrap.appendChild(waypointBadge);
    centerWrap.appendChild(controlsWrap);
    arrowControlRefs.colorPicker = colorPicker;
    arrowControlRefs.colorPickerBtn = colorPickerBtn;
    arrowControlRefs.widthInput = widthInput;
    arrowControlRefs.headSelect = headSelect;
    arrowControlRefs.dashSelect = dashSelect;
    arrowControlRefs.lineSelect = lineSelect;
    arrowControlRefs.opacityInput = opacityInput;
    arrowControlRefs.colorPresetsRow = colorPresetsRow;
    arrowControlRefs.labelInput = labelInput;
    arrowControlRefs.labelPositionSelect = labelPositionSelect;
    arrowControlRefs.labelOffsetInput = labelOffsetInput;
    arrowControlRefs.smoothToggle = smoothToggle;
    arrowControlRefs.waypointBadge = waypointBadge;
    arrowControlRefs.curveToggle = curveToggle;
    return container;
  }
  function updateArrowStylePanel(arrowData) {
    const toolbar = document.getElementById("editable-toolbar");
    if (!toolbar)
      return;
    const arrowPanel = toolbar.querySelector(".toolbar-panel-arrow");
    if (!arrowPanel)
      return;
    let arrowControls = arrowPanel.querySelector(".arrow-style-controls");
    if (!arrowControls) {
      arrowControls = createArrowStyleControls();
      arrowPanel.appendChild(arrowControls);
    }
    if (arrowData) {
      const { colorPicker, colorPickerBtn, widthInput, headSelect, dashSelect, lineSelect, opacityInput, colorPresetsRow, labelInput, labelPositionSelect, labelOffsetInput } = arrowControlRefs;
      if (colorPicker) {
        const colorValue = arrowData.color === "black" ? "#000000" : arrowData.color;
        colorPicker.value = colorValue;
        if (colorPickerBtn)
          colorPickerBtn.style.backgroundColor = colorValue;
        syncOpacitySliderColor(colorValue);
        if (colorPresetsRow) {
          colorPresetsRow.querySelectorAll(".arrow-color-swatch").forEach((s) => {
            s.classList.toggle("selected", s.style.backgroundColor === colorValue || rgbToHex(s.style.backgroundColor) === colorValue.toLowerCase());
          });
        }
      }
      if (widthInput) {
        widthInput.value = arrowData.width.toString();
      }
      if (headSelect) {
        headSelect.value = arrowData.head || "arrow";
      }
      if (dashSelect) {
        dashSelect.value = arrowData.dash || "solid";
      }
      if (lineSelect) {
        lineSelect.value = arrowData.line || "single";
      }
      if (opacityInput) {
        opacityInput.value = (arrowData.opacity !== void 0 ? arrowData.opacity : 1).toString();
      }
      if (labelInput) {
        labelInput.value = arrowData.label || "";
      }
      if (labelPositionSelect) {
        labelPositionSelect.value = arrowData.labelPosition || CONFIG.ARROW_DEFAULT_LABEL_POSITION;
      }
      if (labelOffsetInput) {
        labelOffsetInput.value = (arrowData.labelOffset !== void 0 ? arrowData.labelOffset : CONFIG.ARROW_DEFAULT_LABEL_OFFSET).toString();
      }
      updateCurveToggleInToolbar(arrowData);
      updateSmoothToggleInToolbar(arrowData);
      showRightPanel("arrow");
    } else {
      showRightPanel("default");
    }
  }
  function updateCurveToggleInToolbar(arrowData) {
    const curveToggle = document.querySelector("#arrow-style-curve");
    if (!curveToggle)
      return;
    const hasWaypoints = arrowData && arrowData.waypoints && arrowData.waypoints.length > 0;
    if (hasWaypoints) {
      curveToggle.classList.remove("disabled");
      curveToggle.classList.remove("active");
      curveToggle.title = "Switch to curve mode (clears waypoints)";
    } else {
      curveToggle.classList.remove("disabled");
      curveToggle.title = "Toggle curve mode";
      if (arrowData && arrowData.curveMode) {
        curveToggle.classList.add("active");
      } else {
        curveToggle.classList.remove("active");
      }
    }
  }
  function updateSmoothToggleInToolbar(arrowData) {
    const smoothToggle = arrowControlRefs.smoothToggle || document.querySelector("#arrow-style-smooth");
    const waypointBadge = arrowControlRefs.waypointBadge || document.querySelector("#arrow-style-waypoint-count");
    if (!smoothToggle || !waypointBadge)
      return;
    const hasWaypoints = arrowData && arrowData.waypoints && arrowData.waypoints.length > 0;
    waypointBadge.textContent = hasWaypoints ? `${arrowData.waypoints.length} wp` : "0 wp";
    smoothToggle.classList.toggle("active", !!(arrowData && arrowData.smooth && hasWaypoints));
  }
  function getDashArray(dash, width) {
    if (dash === "dashed")
      return `${width * 4},${width * 2}`;
    if (dash === "dotted")
      return `${width},${width * 2}`;
    return "none";
  }
  function updateArrowAppearance(arrowData) {
    if (!arrowData._path)
      return;
    arrowData._path.setAttribute("stroke", arrowData.color);
    arrowData._path.setAttribute("stroke-width", arrowData.width);
    if (arrowData._labelText) {
      arrowData._labelText.setAttribute("fill", arrowData.color);
    }
    const dashArray = getDashArray(arrowData.dash, arrowData.width);
    if (dashArray === "none") {
      arrowData._path.removeAttribute("stroke-dasharray");
    } else {
      arrowData._path.setAttribute("stroke-dasharray", dashArray);
    }
    const opacity = arrowData.opacity !== void 0 ? arrowData.opacity : 1;
    arrowData._path.setAttribute("opacity", opacity);
    updateArrowLineStyle(arrowData);
    updateArrowheadMarker(arrowData);
  }
  function offsetPointPerpendicular(x, y, tangentX, tangentY, offsetAmount) {
    const len = Math.sqrt(tangentX * tangentX + tangentY * tangentY);
    if (len === 0)
      return { x, y };
    const normalX = -tangentY / len;
    const normalY = tangentX / len;
    return {
      x: x + normalX * offsetAmount,
      y: y + normalY * offsetAmount
    };
  }
  function createOffsetPathD(arrowData, offsetAmount) {
    const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;
    if (control1X !== null && control2X !== null) {
      const startTangent = { x: control1X - fromX, y: control1Y - fromY };
      const endTangent = { x: toX - control2X, y: toY - control2Y };
      const c1Tangent = { x: control2X - fromX, y: control2Y - fromY };
      const c2Tangent = { x: toX - control1X, y: toY - control1Y };
      const newFrom = offsetPointPerpendicular(fromX, fromY, startTangent.x, startTangent.y, offsetAmount);
      const newC1 = offsetPointPerpendicular(control1X, control1Y, c1Tangent.x, c1Tangent.y, offsetAmount);
      const newC2 = offsetPointPerpendicular(control2X, control2Y, c2Tangent.x, c2Tangent.y, offsetAmount);
      const newTo = offsetPointPerpendicular(toX, toY, endTangent.x, endTangent.y, offsetAmount);
      return `M ${newFrom.x},${newFrom.y} C ${newC1.x},${newC1.y} ${newC2.x},${newC2.y} ${newTo.x},${newTo.y}`;
    } else if (control1X !== null) {
      const startTangent = { x: control1X - fromX, y: control1Y - fromY };
      const controlTangent = { x: toX - fromX, y: toY - fromY };
      const endTangent = { x: toX - control1X, y: toY - control1Y };
      const newFrom = offsetPointPerpendicular(fromX, fromY, startTangent.x, startTangent.y, offsetAmount);
      const newC1 = offsetPointPerpendicular(control1X, control1Y, controlTangent.x, controlTangent.y, offsetAmount);
      const newTo = offsetPointPerpendicular(toX, toY, endTangent.x, endTangent.y, offsetAmount);
      return `M ${newFrom.x},${newFrom.y} Q ${newC1.x},${newC1.y} ${newTo.x},${newTo.y}`;
    } else {
      const tangent = { x: toX - fromX, y: toY - fromY };
      const newFrom = offsetPointPerpendicular(fromX, fromY, tangent.x, tangent.y, offsetAmount);
      const newTo = offsetPointPerpendicular(toX, toY, tangent.x, tangent.y, offsetAmount);
      return `M ${newFrom.x},${newFrom.y} L ${newTo.x},${newTo.y}`;
    }
  }
  function updateArrowLineStyle(arrowData) {
    if (!arrowData._svg || !arrowData._path)
      return;
    const existingLines = arrowData._svg.querySelectorAll(".arrow-extra-line");
    existingLines.forEach((line) => line.remove());
    const lineStyle = arrowData.line || "single";
    if (lineStyle === "single") {
      arrowData._path.setAttribute("stroke", arrowData.color);
      arrowData._path.style.visibility = "visible";
      return;
    }
    const offset = arrowData.width * CONFIG.ARROW_DOUBLE_LINE_OFFSET_MULTIPLIER;
    const createOffsetPath = (offsetAmount) => {
      const extraPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      extraPath.className.baseVal = "arrow-extra-line";
      extraPath.setAttribute("stroke", arrowData.color);
      extraPath.setAttribute("stroke-width", arrowData.width);
      extraPath.setAttribute("fill", "none");
      extraPath.style.pointerEvents = "none";
      const dashArray = getDashArray(arrowData.dash, arrowData.width);
      if (dashArray !== "none") {
        extraPath.setAttribute("stroke-dasharray", dashArray);
      }
      const opacity = arrowData.opacity !== void 0 ? arrowData.opacity : 1;
      extraPath.setAttribute("opacity", opacity);
      const offsetPathD = createOffsetPathD(arrowData, offsetAmount);
      extraPath.setAttribute("d", offsetPathD);
      return extraPath;
    };
    if (lineStyle === "double") {
      const line1 = createOffsetPath(-offset);
      const line2 = createOffsetPath(offset);
      arrowData._svg.insertBefore(line1, arrowData._path);
      arrowData._svg.insertBefore(line2, arrowData._path);
      arrowData._path.style.visibility = "visible";
      arrowData._path.setAttribute("stroke", "transparent");
    } else if (lineStyle === "triple") {
      const line1 = createOffsetPath(-offset);
      const line2 = createOffsetPath(offset);
      arrowData._svg.insertBefore(line1, arrowData._path);
      arrowData._svg.insertBefore(line2, arrowData._path);
      arrowData._path.style.visibility = "visible";
      arrowData._path.setAttribute("stroke", arrowData.color);
    }
  }
  function updateArrowheadMarker(arrowData) {
    if (!arrowData._svg || !arrowData._markerId)
      return;
    const marker = arrowData._svg.querySelector(`#${arrowData._markerId}`);
    if (!marker)
      return;
    const markerPath = marker.querySelector("path");
    if (!markerPath)
      return;
    markerPath.setAttribute("fill", arrowData.color);
    const size = 10;
    let pathD;
    let refX = 0;
    switch (arrowData.head) {
      case "stealth":
        const w = size * 1.2;
        pathD = `M 0 0 L ${w} ${size / 2} L 0 ${size} L ${w * 0.3} ${size / 2} z`;
        refX = w * 0.3;
        break;
      case "diamond":
        pathD = `M 0 ${size / 2} L ${size / 2} 0 L ${size} ${size / 2} L ${size / 2} ${size} z`;
        refX = size / 2;
        break;
      case "circle":
        const r = size / 2;
        pathD = `M ${r} 0 A ${r} ${r} 0 1 1 ${r} ${size} A ${r} ${r} 0 1 1 ${r} 0`;
        refX = r;
        marker.setAttribute("refY", r);
        break;
      case "square":
        pathD = `M 0 0 L ${size} 0 L ${size} ${size} L 0 ${size} z`;
        refX = size / 2;
        break;
      case "bar":
        const bw = size / 3;
        pathD = `M 0 0 L ${bw} 0 L ${bw} ${size} L 0 ${size} z`;
        refX = bw / 2;
        break;
      case "none":
        pathD = "";
        break;
      default:
        pathD = `M 0 0 L ${size} ${size / 2} L 0 ${size} z`;
        refX = 0;
        marker.setAttribute("refY", size / 2);
    }
    markerPath.setAttribute("d", pathD);
    marker.setAttribute("refX", refX);
    if (arrowData.head === "none") {
      arrowData._path.removeAttribute("marker-end");
    } else {
      arrowData._path.setAttribute("marker-end", `url(#${arrowData._markerId})`);
    }
  }
  function updateArrowActiveState(arrowData) {
    if (!arrowData._container)
      return;
    const showControls = arrowData.isActive;
    if (arrowData._startHandle) {
      arrowData._startHandle.style.display = showControls ? "" : "none";
    }
    if (arrowData._endHandle) {
      arrowData._endHandle.style.display = showControls ? "" : "none";
    }
    if (arrowData._control1Handle) {
      arrowData._control1Handle.style.display = showControls && arrowData.curveMode ? "" : "none";
    }
    if (arrowData._control2Handle) {
      arrowData._control2Handle.style.display = showControls && arrowData.curveMode ? "" : "none";
    }
    if (arrowData._guideLine1) {
      arrowData._guideLine1.style.display = showControls && arrowData.curveMode && arrowData.control1X !== null ? "" : "none";
    }
    if (arrowData._guideLine2) {
      arrowData._guideLine2.style.display = showControls && arrowData.curveMode && arrowData.control2X !== null ? "" : "none";
    }
    if (showControls) {
      arrowData._container.classList.add("active");
    } else {
      arrowData._container.classList.remove("active");
    }
  }
  async function addNewArrow() {
    if (!await showArrowExtensionWarning()) {
      return null;
    }
    const currentSlide = getCurrentSlide();
    if (!currentSlide) {
      console.warn("No current slide found");
      return null;
    }
    pushUndoState();
    const slideIndex = getCurrentSlideIndex();
    const slideWidth = currentSlide.offsetWidth || CONFIG.DEFAULT_SLIDE_WIDTH;
    const slideHeight = currentSlide.offsetHeight || CONFIG.DEFAULT_SLIDE_HEIGHT;
    const centerX = slideWidth / 2;
    const centerY = slideHeight / 2;
    const halfLength = CONFIG.NEW_ARROW_LENGTH / 2;
    const arrowData = {
      fromX: centerX - halfLength,
      fromY: centerY,
      toX: centerX + halfLength,
      toY: centerY,
      control1X: null,
      control1Y: null,
      control2X: null,
      control2Y: null,
      curveMode: false,
      waypoints: [],
      smooth: false,
      color: CONFIG.ARROW_DEFAULT_COLOR,
      width: CONFIG.ARROW_DEFAULT_WIDTH,
      head: "arrow",
      dash: "solid",
      line: "single",
      opacity: 1,
      label: "",
      labelPosition: CONFIG.ARROW_DEFAULT_LABEL_POSITION,
      labelOffset: CONFIG.ARROW_DEFAULT_LABEL_OFFSET,
      isActive: true
    };
    const arrowContainer = createArrowElement(arrowData);
    currentSlide.appendChild(arrowContainer);
    arrowData.element = arrowContainer;
    const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");
    if (isOnNewSlide) {
      const newSlideEntry = NewElementRegistry.newSlides.find(
        (s) => s.element === currentSlide
      );
      NewElementRegistry.addArrow(arrowData, slideIndex, newSlideEntry || null);
    } else {
      const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
      const originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
      NewElementRegistry.addArrow(arrowData, originalSlideIndex, null);
    }
    debug("Added new arrow to slide", slideIndex, "-> QMD heading index", getQmdHeadingIndex(slideIndex));
    return arrowContainer;
  }
  function createArrowElement(arrowData) {
    const container = document.createElement("div");
    container.className = "editable-arrow-container editable-new";
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.pointerEvents = "none";
    container.style.zIndex = "100";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.overflow = "visible";
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    const markerId = "arrowhead-" + Math.random().toString(36).substring(2, 11);
    marker.setAttribute("id", markerId);
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "0");
    marker.setAttribute("refY", "5");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowPath.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);
    const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitArea.setAttribute("stroke", "transparent");
    hitArea.setAttribute("stroke-width", "20");
    hitArea.setAttribute("stroke-linecap", "round");
    hitArea.setAttribute("fill", "none");
    hitArea.style.pointerEvents = "auto";
    hitArea.style.cursor = "pointer";
    svg.appendChild(hitArea);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("stroke", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
    path.setAttribute("stroke-width", arrowData.width || CONFIG.ARROW_DEFAULT_WIDTH);
    path.setAttribute("fill", "none");
    path.setAttribute("marker-end", `url(#${markerId})`);
    path.style.pointerEvents = "none";
    svg.appendChild(path);
    const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    labelText.className.baseVal = "editable-arrow-label";
    labelText.setAttribute("text-anchor", "middle");
    labelText.setAttribute("dominant-baseline", "middle");
    labelText.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
    labelText.style.pointerEvents = "none";
    labelText.style.userSelect = "none";
    labelText.style.fontSize = "14px";
    labelText.style.fontFamily = "system-ui, -apple-system, sans-serif";
    svg.appendChild(labelText);
    const guideLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    guideLine1.setAttribute("stroke", CONFIG.ARROW_CONTROL1_COLOR);
    guideLine1.setAttribute("stroke-width", "1");
    guideLine1.setAttribute("stroke-dasharray", "4,4");
    guideLine1.setAttribute("opacity", "0.6");
    guideLine1.style.display = "none";
    svg.appendChild(guideLine1);
    const guideLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    guideLine2.setAttribute("stroke", CONFIG.ARROW_CONTROL2_COLOR);
    guideLine2.setAttribute("stroke-width", "1");
    guideLine2.setAttribute("stroke-dasharray", "4,4");
    guideLine2.setAttribute("opacity", "0.6");
    guideLine2.style.display = "none";
    svg.appendChild(guideLine2);
    container.appendChild(svg);
    arrowData._path = path;
    arrowData._hitArea = hitArea;
    arrowData._svg = svg;
    arrowData._markerId = markerId;
    arrowData._guideLine1 = guideLine1;
    arrowData._guideLine2 = guideLine2;
    arrowData._labelText = labelText;
    arrowData._container = container;
    const startHandle = createArrowHandle(arrowData, "start");
    const endHandle = createArrowHandle(arrowData, "end");
    container.appendChild(startHandle);
    container.appendChild(endHandle);
    arrowData._startHandle = startHandle;
    arrowData._endHandle = endHandle;
    const control1Handle = createArrowHandle(arrowData, "control1");
    const control2Handle = createArrowHandle(arrowData, "control2");
    control1Handle.style.display = "none";
    control2Handle.style.display = "none";
    container.appendChild(control1Handle);
    container.appendChild(control2Handle);
    arrowData._control1Handle = control1Handle;
    arrowData._control2Handle = control2Handle;
    arrowData._waypointHandles = [];
    if (arrowData.waypoints && arrowData.waypoints.length > 0) {
      for (let i = 0; i < arrowData.waypoints.length; i++) {
        const handle = createWaypointHandle(arrowData, i);
        container.appendChild(handle);
        arrowData._waypointHandles.push(handle);
      }
    }
    const arrowDragController = new AbortController();
    arrowData._dragController = arrowDragController;
    let isDraggingArrow = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let arrowDragScale = 1;
    const startArrowDrag = (e) => {
      e.stopPropagation();
      setActiveArrow(arrowData);
      pushUndoState();
      isDraggingArrow = true;
      arrowDragScale = getSlideScale();
      ({ clientX: dragStartX, clientY: dragStartY } = getRawClient(e));
      hitArea.style.cursor = "grabbing";
    };
    const onArrowDrag = (e) => {
      if (!isDraggingArrow)
        return;
      e.preventDefault();
      const { clientX, clientY } = getRawClient(e);
      const deltaX = (clientX - dragStartX) / arrowDragScale;
      const deltaY = (clientY - dragStartY) / arrowDragScale;
      arrowData.fromX += deltaX;
      arrowData.fromY += deltaY;
      arrowData.toX += deltaX;
      arrowData.toY += deltaY;
      if (arrowData.control1X !== null) {
        arrowData.control1X += deltaX;
        arrowData.control1Y += deltaY;
      }
      if (arrowData.control2X !== null) {
        arrowData.control2X += deltaX;
        arrowData.control2Y += deltaY;
      }
      if (arrowData.waypoints && arrowData.waypoints.length > 0) {
        for (const wp of arrowData.waypoints) {
          wp.x += deltaX;
          wp.y += deltaY;
        }
      }
      dragStartX = clientX;
      dragStartY = clientY;
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
    };
    const endArrowDrag = () => {
      isDraggingArrow = false;
      hitArea.style.cursor = "grab";
    };
    hitArea.addEventListener("mousedown", startArrowDrag);
    document.addEventListener("mousemove", onArrowDrag, { signal: arrowDragController.signal });
    document.addEventListener("mouseup", endArrowDrag, { signal: arrowDragController.signal });
    hitArea.addEventListener("dblclick", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      const scale = getSlideScale();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      const insertIndex = findWaypointInsertIndex(arrowData, x, y);
      addWaypoint(arrowData, x, y, insertIndex);
    });
    hitArea.style.cursor = "grab";
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateArrowLabel(arrowData);
    setActiveArrow(arrowData);
    if (!globalClickOutsideHandlerRegistered) {
      globalClickOutsideHandlerRegistered = true;
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".arrow-color-presets-popover") && !e.target.closest(".arrow-icon-select-dropdown")) {
          document.querySelectorAll(".arrow-icon-select-dropdown, .arrow-color-presets-popover").forEach((el) => el.style.display = "none");
        }
        if (activeArrow && !e.target.closest(".editable-arrow-container") && !e.target.closest(".editable-toolbar") && !e.target.closest(".arrow-color-presets-popover") && !e.target.closest(".arrow-icon-select-dropdown")) {
          setActiveArrow(null);
        }
      });
    }
    return container;
  }
  function createHandleElement(className, ariaLabel, size, bgColor) {
    const handle = document.createElement("div");
    handle.className = className;
    handle.style.position = "absolute";
    handle.style.width = size + "px";
    handle.style.height = size + "px";
    handle.style.borderRadius = "50%";
    handle.style.backgroundColor = bgColor;
    handle.style.border = "2px solid white";
    handle.style.cursor = "move";
    handle.style.pointerEvents = "auto";
    handle.style.transform = "translate(-50%, -50%)";
    handle.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", ariaLabel);
    handle.setAttribute("tabindex", "0");
    const controller = new AbortController();
    handle._dragController = controller;
    return { handle, controller };
  }
  function setupHandleDrag(handle, controller, onDrag) {
    let isDragging = false;
    let cachedScale = 1;
    const startDrag = (e) => {
      pushUndoState();
      isDragging = true;
      cachedScale = getSlideScale();
      e.preventDefault();
      e.stopPropagation();
    };
    const duringDrag = (e) => {
      if (!isDragging)
        return;
      onDrag(e, cachedScale);
    };
    const stopDrag = () => {
      isDragging = false;
    };
    handle.addEventListener("mousedown", startDrag);
    handle.addEventListener("touchstart", startDrag);
    document.addEventListener("mousemove", duringDrag, { signal: controller.signal });
    document.addEventListener("touchmove", duringDrag, { signal: controller.signal });
    document.addEventListener("mouseup", stopDrag, { signal: controller.signal });
    document.addEventListener("touchend", stopDrag, { signal: controller.signal });
  }
  function createArrowHandle(arrowData, position) {
    const isControlPoint = position === "control1" || position === "control2";
    const handleSize = isControlPoint ? CONFIG.ARROW_CONTROL_HANDLE_SIZE : CONFIG.ARROW_HANDLE_SIZE;
    const bgColor = position === "control1" ? CONFIG.ARROW_CONTROL1_COLOR : position === "control2" ? CONFIG.ARROW_CONTROL2_COLOR : "";
    const { handle, controller } = createHandleElement(
      `editable-arrow-handle editable-arrow-handle-${position}`,
      `Arrow ${position} point`,
      handleSize,
      bgColor
    );
    setupHandleDrag(handle, controller, (e, scale) => {
      if (!arrowData.element)
        return;
      const rect = arrowData.element.getBoundingClientRect();
      const { clientX, clientY } = getRawClient(e);
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
      if (position === "start") {
        arrowData.fromX = x;
        arrowData.fromY = y;
      } else if (position === "end") {
        arrowData.toX = x;
        arrowData.toY = y;
      } else if (position === "control1") {
        arrowData.control1X = x;
        arrowData.control1Y = y;
      } else if (position === "control2") {
        arrowData.control2X = x;
        arrowData.control2Y = y;
      }
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
      e.preventDefault();
    });
    return handle;
  }
  function createWaypointHandle(arrowData, waypointIndex) {
    const { handle, controller } = createHandleElement(
      "editable-arrow-handle editable-arrow-handle-waypoint",
      `Arrow waypoint ${waypointIndex + 1}`,
      CONFIG.ARROW_WAYPOINT_HANDLE_SIZE,
      CONFIG.ARROW_WAYPOINT_COLOR
    );
    handle.dataset.waypointIndex = waypointIndex;
    setupHandleDrag(handle, controller, (e, scale) => {
      if (!arrowData.element)
        return;
      const rect = arrowData.element.getBoundingClientRect();
      const { clientX, clientY } = getRawClient(e);
      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;
      const wpIndex = parseInt(handle.dataset.waypointIndex, 10);
      if (arrowData.waypoints[wpIndex]) {
        arrowData.waypoints[wpIndex].x = x;
        arrowData.waypoints[wpIndex].y = y;
      }
      updateArrowPath(arrowData);
      updateArrowHandles(arrowData);
      e.preventDefault();
    });
    const deleteWaypoint = (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeWaypoint(arrowData, parseInt(handle.dataset.waypointIndex, 10));
    };
    handle.addEventListener("dblclick", deleteWaypoint);
    handle.addEventListener("contextmenu", deleteWaypoint);
    handle.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace")
        deleteWaypoint(e);
    });
    return handle;
  }
  function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }
  function findWaypointInsertIndex(arrowData, clickX, clickY) {
    const { fromX, fromY, toX, toY, waypoints } = arrowData;
    const points = [
      { x: fromX, y: fromY },
      ...waypoints || [],
      { x: toX, y: toY }
    ];
    if (!waypoints || waypoints.length === 0) {
      return 0;
    }
    let minDist = Infinity;
    let bestIndex = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dist = distanceToSegment(
        clickX,
        clickY,
        points[i].x,
        points[i].y,
        points[i + 1].x,
        points[i + 1].y
      );
      if (dist < minDist) {
        minDist = dist;
        bestIndex = i;
      }
    }
    return bestIndex;
  }
  function addWaypoint(arrowData, x, y, insertIndex) {
    pushUndoState();
    if (arrowData.curveMode) {
      arrowData.curveMode = false;
      arrowData.control1X = null;
      arrowData.control1Y = null;
      arrowData.control2X = null;
      arrowData.control2Y = null;
      if (arrowData._container) {
        arrowData._container.classList.remove("curve-mode");
      }
      if (arrowData._guideLine1)
        arrowData._guideLine1.style.display = "none";
      if (arrowData._guideLine2)
        arrowData._guideLine2.style.display = "none";
      if (arrowData._control1Handle)
        arrowData._control1Handle.style.display = "none";
      if (arrowData._control2Handle)
        arrowData._control2Handle.style.display = "none";
    }
    if (!arrowData.waypoints) {
      arrowData.waypoints = [];
    }
    const newWaypoint = { x, y };
    if (insertIndex !== void 0 && insertIndex >= 0 && insertIndex <= arrowData.waypoints.length) {
      arrowData.waypoints.splice(insertIndex, 0, newWaypoint);
    } else {
      arrowData.waypoints.push(newWaypoint);
    }
    rebuildWaypointHandles(arrowData);
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateArrowStylePanel(arrowData);
  }
  function removeWaypoint(arrowData, waypointIndex) {
    if (!arrowData.waypoints || waypointIndex < 0 || waypointIndex >= arrowData.waypoints.length) {
      return;
    }
    pushUndoState();
    arrowData.waypoints.splice(waypointIndex, 1);
    rebuildWaypointHandles(arrowData);
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateArrowStylePanel(arrowData);
  }
  function rebuildWaypointHandles(arrowData) {
    if (arrowData._waypointHandles) {
      for (const handle of arrowData._waypointHandles) {
        if (handle._dragController) {
          handle._dragController.abort();
        }
        handle.remove();
      }
    }
    arrowData._waypointHandles = [];
    if (arrowData.waypoints && arrowData.waypoints.length > 0) {
      for (let i = 0; i < arrowData.waypoints.length; i++) {
        const handle = createWaypointHandle(arrowData, i);
        arrowData._container.appendChild(handle);
        arrowData._waypointHandles.push(handle);
      }
    }
    updateArrowHandles(arrowData);
  }
  function catmullRomPath(points) {
    if (points.length < 2)
      return "";
    if (points.length === 2) {
      return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
    }
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }
  function waypointPolylinePath(fromX, fromY, waypoints, toX, toY) {
    let path = `M ${fromX},${fromY}`;
    for (const wp of waypoints) {
      path += ` L ${wp.x},${wp.y}`;
    }
    path += ` L ${toX},${toY}`;
    return path;
  }
  function updateArrowPath(arrowData) {
    if (!arrowData._path)
      return;
    const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y, waypoints, smooth } = arrowData;
    let pathD;
    if (waypoints && waypoints.length > 0) {
      const allPoints = [
        { x: fromX, y: fromY },
        ...waypoints,
        { x: toX, y: toY }
      ];
      if (smooth) {
        pathD = catmullRomPath(allPoints);
      } else {
        pathD = waypointPolylinePath(fromX, fromY, waypoints, toX, toY);
      }
    } else if (control1X !== null && control2X !== null) {
      pathD = `M ${fromX},${fromY} C ${control1X},${control1Y} ${control2X},${control2Y} ${toX},${toY}`;
    } else if (control1X !== null) {
      pathD = `M ${fromX},${fromY} Q ${control1X},${control1Y} ${toX},${toY}`;
    } else {
      pathD = `M ${fromX},${fromY} L ${toX},${toY}`;
    }
    arrowData._path.setAttribute("d", pathD);
    if (arrowData._hitArea) {
      arrowData._hitArea.setAttribute("d", pathD);
    }
    if (arrowData._guideLine1 && arrowData.curveMode) {
      if (control1X !== null) {
        arrowData._guideLine1.setAttribute("x1", fromX);
        arrowData._guideLine1.setAttribute("y1", fromY);
        arrowData._guideLine1.setAttribute("x2", control1X);
        arrowData._guideLine1.setAttribute("y2", control1Y);
        arrowData._guideLine1.style.display = "";
      } else {
        arrowData._guideLine1.style.display = "none";
      }
    }
    if (arrowData._guideLine2 && arrowData.curveMode) {
      if (control2X !== null) {
        arrowData._guideLine2.setAttribute("x1", toX);
        arrowData._guideLine2.setAttribute("y1", toY);
        arrowData._guideLine2.setAttribute("x2", control2X);
        arrowData._guideLine2.setAttribute("y2", control2Y);
        arrowData._guideLine2.style.display = "";
      } else {
        arrowData._guideLine2.style.display = "none";
      }
    }
    if (arrowData.line && arrowData.line !== "single") {
      updateArrowLineStyle(arrowData);
    }
    updateArrowLabel(arrowData);
  }
  function updateArrowHandles(arrowData) {
    if (arrowData._startHandle) {
      arrowData._startHandle.style.left = arrowData.fromX + "px";
      arrowData._startHandle.style.top = arrowData.fromY + "px";
    }
    if (arrowData._endHandle) {
      arrowData._endHandle.style.left = arrowData.toX + "px";
      arrowData._endHandle.style.top = arrowData.toY + "px";
    }
    if (arrowData._control1Handle && arrowData.control1X !== null) {
      arrowData._control1Handle.style.left = arrowData.control1X + "px";
      arrowData._control1Handle.style.top = arrowData.control1Y + "px";
    }
    if (arrowData._control2Handle && arrowData.control2X !== null) {
      arrowData._control2Handle.style.left = arrowData.control2X + "px";
      arrowData._control2Handle.style.top = arrowData.control2Y + "px";
    }
    if (arrowData._waypointHandles && arrowData.waypoints) {
      for (let i = 0; i < arrowData._waypointHandles.length; i++) {
        const handle = arrowData._waypointHandles[i];
        const wp = arrowData.waypoints[i];
        if (handle && wp) {
          handle.style.left = wp.x + "px";
          handle.style.top = wp.y + "px";
        }
      }
    }
  }
  function getPointOnArrow(t, arrowData) {
    const { fromX, fromY, toX, toY, control1X, control1Y, control2X, control2Y } = arrowData;
    let x, y, dx, dy;
    if (control1X !== null && control2X !== null) {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      x = mt3 * fromX + 3 * mt2 * t * control1X + 3 * mt * t2 * control2X + t3 * toX;
      y = mt3 * fromY + 3 * mt2 * t * control1Y + 3 * mt * t2 * control2Y + t3 * toY;
      dx = 3 * mt2 * (control1X - fromX) + 6 * mt * t * (control2X - control1X) + 3 * t2 * (toX - control2X);
      dy = 3 * mt2 * (control1Y - fromY) + 6 * mt * t * (control2Y - control1Y) + 3 * t2 * (toY - control2Y);
    } else if (control1X !== null) {
      const mt = 1 - t;
      const mt2 = mt * mt;
      const t2 = t * t;
      x = mt2 * fromX + 2 * mt * t * control1X + t2 * toX;
      y = mt2 * fromY + 2 * mt * t * control1Y + t2 * toY;
      dx = 2 * mt * (control1X - fromX) + 2 * t * (toX - control1X);
      dy = 2 * mt * (control1Y - fromY) + 2 * t * (toY - control1Y);
    } else {
      x = fromX + t * (toX - fromX);
      y = fromY + t * (toY - fromY);
      dx = toX - fromX;
      dy = toY - fromY;
    }
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return { x, y, angle };
  }
  function updateArrowLabel(arrowData) {
    if (!arrowData._labelText)
      return;
    const label = arrowData.label || "";
    arrowData._labelText.textContent = label;
    if (!label) {
      arrowData._labelText.style.display = "none";
      return;
    }
    arrowData._labelText.style.display = "";
    let t;
    switch (arrowData.labelPosition) {
      case "start":
        t = CONFIG.ARROW_LABEL_T_START;
        break;
      case "end":
        t = CONFIG.ARROW_LABEL_T_END;
        break;
      case "middle":
      default:
        t = CONFIG.ARROW_LABEL_T_MIDDLE;
    }
    const point = getPointOnArrow(t, arrowData);
    const offset = arrowData.labelOffset !== void 0 ? arrowData.labelOffset : CONFIG.ARROW_DEFAULT_LABEL_OFFSET;
    const angleRad = point.angle * (Math.PI / 180);
    const offsetX = -Math.sin(angleRad) * offset;
    const offsetY = Math.cos(angleRad) * offset;
    const labelX = point.x + offsetX;
    const labelY = point.y + offsetY;
    arrowData._labelText.setAttribute("x", labelX);
    arrowData._labelText.setAttribute("y", labelY);
    let rotationAngle = point.angle;
    if (rotationAngle > CONFIG.ARROW_LABEL_FLIP_THRESHOLD || rotationAngle < -CONFIG.ARROW_LABEL_FLIP_THRESHOLD) {
      rotationAngle += 180;
    }
    arrowData._labelText.setAttribute("transform", `rotate(${rotationAngle}, ${labelX}, ${labelY})`);
    arrowData._labelText.setAttribute("fill", arrowData.color || CONFIG.ARROW_DEFAULT_COLOR);
  }
  function toggleCurveMode(arrowData) {
    arrowData.curveMode = !arrowData.curveMode;
    if (arrowData.curveMode) {
      if (arrowData.waypoints && arrowData.waypoints.length > 0) {
        arrowData.waypoints = [];
        arrowData.smooth = false;
        rebuildWaypointHandles(arrowData);
      }
      const { fromX, fromY, toX, toY } = arrowData;
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / len * CONFIG.ARROW_CONTROL_POINT_DISPLACEMENT;
      const perpY = dx / len * CONFIG.ARROW_CONTROL_POINT_DISPLACEMENT;
      arrowData.control1X = fromX + dx / 3 + perpX;
      arrowData.control1Y = fromY + dy / 3 + perpY;
      arrowData.control2X = fromX + 2 * dx / 3 + perpX;
      arrowData.control2Y = fromY + 2 * dy / 3 + perpY;
      if (arrowData._container) {
        arrowData._container.classList.add("curve-mode");
      }
      if (arrowData._control1Handle)
        arrowData._control1Handle.style.display = "";
      if (arrowData._control2Handle)
        arrowData._control2Handle.style.display = "";
    } else {
      arrowData.control1X = null;
      arrowData.control1Y = null;
      arrowData.control2X = null;
      arrowData.control2Y = null;
      if (arrowData._container) {
        arrowData._container.classList.remove("curve-mode");
      }
      if (arrowData._guideLine1)
        arrowData._guideLine1.style.display = "none";
      if (arrowData._guideLine2)
        arrowData._guideLine2.style.display = "none";
      if (arrowData._control1Handle)
        arrowData._control1Handle.style.display = "none";
      if (arrowData._control2Handle)
        arrowData._control2Handle.style.display = "none";
    }
    updateArrowPath(arrowData);
    updateArrowHandles(arrowData);
    updateSmoothToggleInToolbar(arrowData);
  }

  // src/images.js
  var activeImage = null;
  var replaceWarningEl = null;
  function showReplaceWarning(message, anchorEl) {
    if (replaceWarningEl)
      replaceWarningEl.remove();
    const popup = document.createElement("div");
    popup.className = "image-replace-warning";
    popup.setAttribute("role", "alert");
    popup.setAttribute("aria-live", "assertive");
    popup.textContent = `\u26A0 ${message}`;
    document.body.appendChild(popup);
    replaceWarningEl = popup;
    const rect = anchorEl.closest("#editable-toolbar")?.getBoundingClientRect() ?? anchorEl.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 6}px`;
    popup.style.left = "50%";
    popup.style.transform = "translateX(-50%)";
    const timer = setTimeout(() => {
      popup.remove();
      if (replaceWarningEl === popup)
        replaceWarningEl = null;
    }, 4e3);
    popup.addEventListener("click", () => {
      clearTimeout(timer);
      popup.remove();
      if (replaceWarningEl === popup)
        replaceWarningEl = null;
    }, { once: true });
  }
  var imageControlRefs = {
    opacitySlider: null,
    opacityLabel: null,
    borderRadiusInput: null,
    cropBtn: null,
    flipHBtn: null,
    flipVBtn: null
  };
  var cropModeActive = false;
  function withActiveImage(fn) {
    if (!activeImage)
      return;
    const el = editableRegistry.get(activeImage);
    if (!el)
      return;
    fn(el);
  }
  var cropHandleListeners = /* @__PURE__ */ new Map();
  registerDeselectImage(() => setActiveImage(null));
  function setActiveImage(imgEl) {
    if (activeImage && activeImage !== imgEl) {
      exitCropMode();
    }
    if (imgEl && imgEl !== activeImage) {
      deselectArrow();
    }
    activeImage = imgEl;
    if (imgEl) {
      updateImageStylePanel(imgEl);
      showRightPanel("image");
    } else if (!getActiveArrow()) {
      showRightPanel("default");
    }
  }
  function updateImageStylePanel(imgEl) {
    const editableEl = editableRegistry.get(imgEl);
    if (!editableEl)
      return;
    const s = editableEl.state;
    if (imageControlRefs.opacitySlider) {
      imageControlRefs.opacitySlider.value = s.opacity ?? 100;
      imageControlRefs.opacityLabel.textContent = `${s.opacity ?? 100}%`;
    }
    if (imageControlRefs.borderRadiusInput) {
      imageControlRefs.borderRadiusInput.value = s.borderRadius ?? 0;
    }
    if (imageControlRefs.cropBtn) {
      imageControlRefs.cropBtn.classList.toggle("active", cropModeActive);
    }
    if (imageControlRefs.flipHBtn) {
      imageControlRefs.flipHBtn.classList.toggle("active", !!s.flipH);
    }
    if (imageControlRefs.flipVBtn) {
      imageControlRefs.flipVBtn.classList.toggle("active", !!s.flipV);
    }
  }
  function applyTransform(imgEl) {
    const editableEl = editableRegistry.get(imgEl);
    if (!editableEl)
      return;
    const s = editableEl.state;
    const scaleX = s.flipH ? -1 : 1;
    const scaleY = s.flipV ? -1 : 1;
    imgEl.style.transform = scaleX !== 1 || scaleY !== 1 ? `scaleX(${scaleX}) scaleY(${scaleY})` : "";
  }
  function applyCrop(imgEl) {
    const editableEl = editableRegistry.get(imgEl);
    if (!editableEl)
      return;
    const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = editableEl.state;
    imgEl.style.clipPath = ct || cr || cb || cl ? `inset(${ct}px ${cr}px ${cb}px ${cl}px)` : "";
    if (cropModeActive && editableEl.container) {
      const offset = -6;
      editableEl.getResizeHandles().forEach((handle) => {
        const pos = handle.dataset.position;
        handle.style.top = pos.includes("n") ? `${ct + offset}px` : "";
        handle.style.bottom = pos.includes("s") ? `${cb + offset}px` : "";
        handle.style.left = pos.includes("w") ? `${cl + offset}px` : "";
        handle.style.right = pos.includes("e") ? `${cr + offset}px` : "";
      });
    }
  }
  function enterCropMode() {
    if (!activeImage)
      return;
    cropModeActive = true;
    if (imageControlRefs.cropBtn)
      imageControlRefs.cropBtn.classList.add("active");
    const editableEl = editableRegistry.get(activeImage);
    if (!editableEl?.container)
      return;
    editableEl.container.classList.add("crop-mode");
    applyCrop(activeImage);
    editableEl.getResizeHandles().forEach((handle) => {
      const listener = (e) => onCropHandleMousedown(e, activeImage);
      handle.addEventListener("mousedown", listener, true);
      cropHandleListeners.set(handle, listener);
    });
  }
  function exitCropMode() {
    cropModeActive = false;
    if (imageControlRefs.cropBtn)
      imageControlRefs.cropBtn.classList.remove("active");
    cropHandleListeners.forEach((listener, handle) => {
      handle.removeEventListener("mousedown", listener, true);
    });
    cropHandleListeners.clear();
    if (activeImage) {
      const editableEl = editableRegistry.get(activeImage);
      if (editableEl?.container) {
        editableEl.container.classList.remove("crop-mode");
        editableEl.getResizeHandles().forEach((handle) => {
          handle.style.top = "";
          handle.style.bottom = "";
          handle.style.left = "";
          handle.style.right = "";
        });
      }
    }
  }
  function onCropHandleMousedown(e, imgEl) {
    e.stopImmediatePropagation();
    e.preventDefault();
    pushUndoState();
    const pos = e.currentTarget.dataset.position;
    const startX = e.clientX;
    const startY = e.clientY;
    const editableEl = editableRegistry.get(imgEl);
    if (!editableEl)
      return;
    const startCrop = {
      top: editableEl.state.cropTop,
      right: editableEl.state.cropRight,
      bottom: editableEl.state.cropBottom,
      left: editableEl.state.cropLeft
    };
    const rect = imgEl.getBoundingClientRect();
    const slideScale = rect.width > 0 ? rect.width / imgEl.offsetWidth : 1;
    function onMove(me) {
      const el = editableRegistry.get(imgEl);
      if (!el)
        return;
      const dx = (me.clientX - startX) / slideScale;
      const dy = (me.clientY - startY) / slideScale;
      const maxW = imgEl.offsetWidth / 2;
      const maxH = imgEl.offsetHeight / 2;
      if (pos.includes("n"))
        el.state.cropTop = Math.max(0, Math.min(maxH, startCrop.top + dy));
      if (pos.includes("s"))
        el.state.cropBottom = Math.max(0, Math.min(maxH, startCrop.bottom - dy));
      if (pos.includes("w"))
        el.state.cropLeft = Math.max(0, Math.min(maxW, startCrop.left + dx));
      if (pos.includes("e"))
        el.state.cropRight = Math.max(0, Math.min(maxW, startCrop.right - dx));
      applyCrop(imgEl);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }
  function createImageStyleControls() {
    const container = document.createElement("div");
    container.className = "image-style-controls";
    const centerWrap = document.createElement("div");
    centerWrap.className = "image-center-wrap";
    const controlsWrap = document.createElement("div");
    controlsWrap.className = "image-controls-wrap";
    function addCell(labelText) {
      const label = document.createElement("span");
      label.className = "image-ctrl-label";
      label.textContent = labelText;
      controlsWrap.appendChild(label);
      const cell = document.createElement("div");
      cell.className = "image-ctrl-cell";
      controlsWrap.appendChild(cell);
      return cell;
    }
    buildOpacityControl(addCell);
    buildBorderRadiusControl(addCell);
    buildCropControl(addCell);
    buildFlipControl(addCell);
    buildReplaceControl(addCell);
    buildResetControl(addCell);
    centerWrap.appendChild(controlsWrap);
    container.appendChild(centerWrap);
    return container;
  }
  function buildOpacityControl(addCell) {
    const cell = addCell("Opacity");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = "100";
    slider.className = "image-toolbar-opacity";
    slider.title = "Opacity";
    const label = document.createElement("span");
    label.className = "image-opacity-label";
    label.style.display = "none";
    slider.addEventListener("mousedown", () => {
      if (activeImage)
        pushUndoState();
    });
    slider.addEventListener("input", () => {
      const val = parseInt(slider.value, 10);
      label.textContent = `${val}%`;
      withActiveImage((el) => el.setState({ opacity: val }));
    });
    imageControlRefs.opacitySlider = slider;
    imageControlRefs.opacityLabel = label;
    cell.appendChild(slider);
    cell.appendChild(label);
  }
  function buildBorderRadiusControl(addCell) {
    const cell = addCell("Radius");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = "0";
    input.className = "image-toolbar-btn image-toolbar-radius";
    input.title = "Border radius (px)";
    input.addEventListener("focus", () => {
      if (activeImage)
        pushUndoState();
    });
    input.addEventListener("input", () => {
      const val = Math.max(0, parseInt(input.value, 10) || 0);
      withActiveImage((el) => el.setState({ borderRadius: val }));
    });
    imageControlRefs.borderRadiusInput = input;
    cell.appendChild(input);
  }
  function buildCropControl(addCell) {
    const cell = addCell("Crop");
    const btn = document.createElement("button");
    btn.className = "image-toolbar-btn";
    btn.textContent = "\u2702";
    btn.title = "Toggle crop mode \u2014 drag edge handles to crop";
    btn.addEventListener("click", () => {
      if (!activeImage)
        return;
      if (cropModeActive)
        exitCropMode();
      else
        enterCropMode();
    });
    imageControlRefs.cropBtn = btn;
    cell.appendChild(btn);
  }
  function buildFlipControl(addCell) {
    const cell = addCell("Flip");
    const wrap = document.createElement("div");
    wrap.className = "image-btn-group";
    const flipHBtn = document.createElement("button");
    flipHBtn.className = "image-toolbar-btn";
    flipHBtn.textContent = "\u21C6";
    flipHBtn.title = "Flip horizontal";
    flipHBtn.addEventListener("click", () => {
      pushUndoState();
      withActiveImage((el) => {
        el.state.flipH = !el.state.flipH;
        flipHBtn.classList.toggle("active", el.state.flipH);
        applyTransform(activeImage);
      });
    });
    imageControlRefs.flipHBtn = flipHBtn;
    const flipVBtn = document.createElement("button");
    flipVBtn.className = "image-toolbar-btn";
    flipVBtn.textContent = "\u21C5";
    flipVBtn.title = "Flip vertical";
    flipVBtn.addEventListener("click", () => {
      pushUndoState();
      withActiveImage((el) => {
        el.state.flipV = !el.state.flipV;
        flipVBtn.classList.toggle("active", el.state.flipV);
        applyTransform(activeImage);
      });
    });
    imageControlRefs.flipVBtn = flipVBtn;
    wrap.appendChild(flipHBtn);
    wrap.appendChild(flipVBtn);
    cell.appendChild(wrap);
  }
  function buildReplaceControl(addCell) {
    const cell = addCell("Replace");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
    const btn = document.createElement("button");
    btn.className = "image-toolbar-btn";
    btn.textContent = "Replace";
    btn.title = "Replace image source";
    btn.addEventListener("click", () => {
      if (activeImage)
        fileInput.click();
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file || !activeImage)
        return;
      pushUndoState();
      const el = editableRegistry.get(activeImage);
      if (el)
        el.state.src = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        const tmp = new Image();
        tmp.onload = () => {
          const img = activeImage;
          const imgEl = editableRegistry.get(img);
          if (!imgEl)
            return;
          const newHeight = Math.round(imgEl.state.width * tmp.naturalHeight / tmp.naturalWidth);
          imgEl.state.height = newHeight;
          img.style.height = `${newHeight}px`;
          if (imgEl.container)
            imgEl.container.style.height = `${newHeight}px`;
        };
        tmp.src = dataUrl;
        activeImage.src = dataUrl;
        showReplaceWarning(`Place "${file.name}" next to your QMD file.`, btn);
      };
      reader.readAsDataURL(file);
      fileInput.value = "";
    });
    cell.appendChild(btn);
    cell.appendChild(fileInput);
  }
  function buildResetControl(addCell) {
    const cell = addCell("");
    const btn = document.createElement("button");
    btn.className = "image-toolbar-btn image-toolbar-reset";
    btn.textContent = "Reset";
    btn.title = "Reset image style properties";
    btn.addEventListener("click", () => {
      if (!activeImage)
        return;
      pushUndoState();
      const el = editableRegistry.get(activeImage);
      if (!el)
        return;
      Object.assign(el.state, {
        opacity: 100,
        borderRadius: 0,
        cropTop: 0,
        cropRight: 0,
        cropBottom: 0,
        cropLeft: 0,
        flipH: false,
        flipV: false
      });
      activeImage.style.opacity = "";
      activeImage.style.borderRadius = "";
      activeImage.style.clipPath = "";
      activeImage.style.transform = "";
      exitCropMode();
      updateImageStylePanel(activeImage);
    });
    cell.appendChild(btn);
  }

  // src/toolbar.js
  var rightZoneEl = null;
  var textPanelEl = null;
  var contextHideElements = [];
  function showRightPanel(panelName) {
    if (!rightZoneEl)
      return;
    rightZoneEl.querySelectorAll(".toolbar-panel").forEach((panel) => {
      panel.style.display = panel.classList.contains(`toolbar-panel-${panelName}`) ? "" : "none";
    });
    const isContext = panelName !== "default";
    contextHideElements.forEach((el) => {
      el.style.display = isContext ? "none" : "";
    });
  }
  function createFloatingToolbar() {
    if (document.getElementById("editable-toolbar")) {
      return document.getElementById("editable-toolbar");
    }
    const toolbar = document.createElement("div");
    toolbar.id = "editable-toolbar";
    toolbar.className = "editable-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Editable tools");
    const leftZone = document.createElement("div");
    leftZone.className = "editable-toolbar-left";
    const leftButtonStack = document.createElement("div");
    leftButtonStack.className = "editable-toolbar-button-stack";
    const unstackedButtons = [];
    ToolbarRegistry.getActionsForZone("left").forEach((action) => {
      const btn = action.submenu ? ToolbarRegistry.createSubmenuButton(action) : ToolbarRegistry.createButton(action);
      if (action.stacked === false) {
        unstackedButtons.push({ btn, action });
      } else {
        leftButtonStack.appendChild(btn);
      }
    });
    contextHideElements.push(leftButtonStack);
    leftZone.appendChild(leftButtonStack);
    unstackedButtons.forEach(({ btn, action }) => {
      leftZone.appendChild(btn);
      if (action.hideOnContext)
        contextHideElements.push(btn);
    });
    toolbar.appendChild(leftZone);
    const rightZone = document.createElement("div");
    rightZone.className = "editable-toolbar-right";
    rightZoneEl = rightZone;
    const defaultPanel = document.createElement("div");
    defaultPanel.className = "toolbar-panel toolbar-panel-default";
    ToolbarRegistry.getActionsForZone("right").forEach((action) => {
      defaultPanel.appendChild(
        action.submenu ? ToolbarRegistry.createSubmenuButton(action) : ToolbarRegistry.createButton(action)
      );
    });
    rightZone.appendChild(defaultPanel);
    const arrowPanel = document.createElement("div");
    arrowPanel.className = "toolbar-panel toolbar-panel-arrow";
    arrowPanel.style.display = "none";
    rightZone.appendChild(arrowPanel);
    const imagePanel = document.createElement("div");
    imagePanel.className = "toolbar-panel toolbar-panel-image";
    imagePanel.style.display = "none";
    imagePanel.appendChild(createImageStyleControls());
    rightZone.appendChild(imagePanel);
    const textPanel = document.createElement("div");
    textPanel.className = "toolbar-panel toolbar-panel-text";
    textPanel.style.display = "none";
    rightZone.appendChild(textPanel);
    textPanelEl = textPanel;
    const modifyPanel = document.createElement("div");
    modifyPanel.className = "toolbar-panel toolbar-panel-modify";
    modifyPanel.style.display = "none";
    rightZone.appendChild(modifyPanel);
    toolbar.appendChild(rightZone);
    document.body.appendChild(toolbar);
    document.documentElement.classList.add("has-editable-toolbar");
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return toolbar;
  }

  // src/registries.js
  var ControlRegistry = {
    /** @type {Map<string, Object>} Registered controls by name */
    controls: /* @__PURE__ */ new Map(),
    /**
     * Register a new control.
     * @param {string} name - Unique control name
     * @param {Object} config - Control configuration
     * @param {string} config.icon - Button text/icon
     * @param {string} config.ariaLabel - Accessibility label
     * @param {string} config.title - Tooltip text
     * @param {string} [config.className] - Additional CSS class
     * @param {string[]} config.appliesTo - Element types this control applies to
     * @param {Function} config.onClick - Click handler (element, btn, event)
     */
    register(name, config4) {
      this.controls.set(name, { name, ...config4 });
    },
    /**
     * Get controls applicable to an element type.
     * @param {string} elementType - Element type ("img" or "div")
     * @returns {Object[]} Array of control configs
     */
    getControlsFor(elementType) {
      return [...this.controls.values()].filter(
        (c) => c.appliesTo.includes(elementType)
      );
    },
    /**
     * Create a button element from a control config.
     * @param {Object} config - Control configuration
     * @param {HTMLElement} element - The editable element
     * @returns {HTMLButtonElement} The created button
     */
    createButton(config4, element) {
      const btn = createButton(config4.icon, config4.className || "");
      btn.setAttribute("aria-label", config4.ariaLabel);
      btn.title = config4.title;
      if (config4.toggle)
        btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        config4.onClick(element, btn, e);
      });
      return btn;
    }
  };
  ControlRegistry.register("decreaseFont", {
    icon: "A-",
    ariaLabel: "Decrease font size",
    title: "Decrease font size",
    className: "editable-button-font editable-button-decrease",
    appliesTo: ["div", "p"],
    onClick: (element) => {
      pushUndoState();
      changeFontSize(element, -CONFIG.FONT_SIZE_STEP, editableRegistry);
    }
  });
  ControlRegistry.register("increaseFont", {
    icon: "A+",
    ariaLabel: "Increase font size",
    title: "Increase font size",
    className: "editable-button-font editable-button-increase",
    appliesTo: ["div", "p"],
    onClick: (element) => {
      pushUndoState();
      changeFontSize(element, CONFIG.FONT_SIZE_STEP, editableRegistry);
    }
  });
  for (const [name, icon, label, value] of [
    ["alignLeft", "\u21E4", "Left", "left"],
    ["alignCenter", "\u21D4", "Center", "center"],
    ["alignRight", "\u21E5", "Right", "right"]
  ]) {
    ControlRegistry.register(`align${label}`, {
      icon,
      ariaLabel: `Align text ${value}`,
      title: `Align ${label}`,
      className: "editable-button-align",
      appliesTo: ["div", "p"],
      onClick: (element) => {
        pushUndoState();
        const editableElt = editableRegistry.get(element);
        if (editableElt) {
          editableElt.setState({ textAlign: value });
          editableElt.syncToDOM();
        }
      }
    });
  }
  ControlRegistry.register("editMode", {
    icon: "\u270E",
    ariaLabel: "Toggle edit mode",
    title: "Edit Text",
    className: "editable-button-edit",
    toggle: true,
    appliesTo: ["div", "p"],
    onClick: (element, btn) => {
      const isEditing = btn.classList.contains("active");
      const quillData = quillInstances.get(element);
      const textPanel = document.querySelector(".toolbar-panel-text");
      if (!isEditing) {
        if (quillData) {
          if (quillData.toolbarContainer && textPanel) {
            textPanel.appendChild(quillData.toolbarContainer);
          }
          quillData.isEditing = true;
          quillData.quill.enable(true);
          quillData.quill.focus();
        }
        showRightPanel("text");
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        btn.title = "Exit Edit Mode";
      } else {
        if (quillData) {
          if (quillData.toolbarContainer) {
            element.insertBefore(quillData.toolbarContainer, element.firstChild);
          }
          quillData.isEditing = false;
          quillData.quill.enable(false);
        }
        showRightPanel("default");
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
        btn.title = "Edit Text";
        window.getSelection().removeAllRanges();
      }
    }
  });
  var NewElementRegistry = {
    /** @type {Array<{element: HTMLElement, slideIndex: number, content: string, newSlideRef: Object|null}>} */
    newDivs: [],
    /** @type {Array<{element: HTMLElement, afterSlideIndex: number, insertAfterNewSlide: Object|null, insertionOrder: number}>} */
    newSlides: [],
    /** @type {Array<Object>} Arrow data objects */
    newArrows: [],
    /**
     * Add a new text div to tracking.
     * @param {HTMLElement} div - The div element
     * @param {number} slideIndex - Index of the slide containing the div
     * @param {Object|null} [newSlideRef=null] - Reference to newSlides entry if on a new slide
     */
    addDiv(div, slideIndex, newSlideRef = null) {
      this.newDivs.push({
        element: div,
        slideIndex,
        content: div.textContent || CONFIG.NEW_TEXT_CONTENT,
        newSlideRef
      });
    },
    /**
     * Add a new slide to tracking.
     * @param {HTMLElement} slide - The slide section element
     * @param {number} afterSlideIndex - Original slide index to insert after
     * @param {Object|null} [insertAfterNewSlide=null] - Parent new slide for chained insertions
     */
    addSlide(slide, afterSlideIndex, insertAfterNewSlide = null) {
      this.newSlides.push({
        element: slide,
        afterSlideIndex,
        insertAfterNewSlide,
        insertionOrder: this.newSlides.length
      });
    },
    /**
     * Add a new arrow to tracking.
     * Stores reference directly so drag updates are reflected.
     * @param {Object} arrowData - Arrow data object
     * @param {number} slideIndex - Index of the slide containing the arrow
     * @param {Object|null} [newSlideRef=null] - Reference to newSlides entry if on a new slide
     */
    addArrow(arrowData, slideIndex, newSlideRef = null) {
      arrowData.slideIndex = slideIndex;
      arrowData.newSlideRef = newSlideRef;
      this.newArrows.push(arrowData);
    },
    /**
     * Count new slides inserted before a given index (for offset calculation).
     * @param {number} index - The slide index
     * @returns {number} Count of new slides before this index
     */
    countNewSlidesBefore(index) {
      return this.newSlides.filter((s) => s.afterSlideIndex < index).length;
    },
    /**
     * Clear all tracked elements (e.g., after save).
     */
    clear() {
      this.newDivs = [];
      this.newSlides = [];
      this.newArrows = [];
    },
    /**
     * Check if there are any new elements tracked.
     * @returns {boolean} True if any new elements exist
     */
    hasNewElements() {
      return this.newDivs.length > 0 || this.newSlides.length > 0 || this.newArrows.length > 0;
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".editable-toolbar-submenu-wrapper")) {
        document.querySelectorAll(".editable-toolbar-submenu.open").forEach((menu) => {
          menu.classList.remove("open");
          const btn = menu.previousElementSibling;
          if (btn)
            btn.setAttribute("aria-expanded", "false");
        });
      }
    });
  }
  function setButtonContent(btn, icon, label) {
    const iconSpan = document.createElement("span");
    iconSpan.className = "toolbar-icon";
    iconSpan.textContent = icon;
    const labelSpan = document.createElement("span");
    labelSpan.className = "toolbar-label";
    labelSpan.textContent = label;
    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);
  }
  var ToolbarRegistry = {
    /** @type {Map<string, Object>} Registered actions by name */
    actions: /* @__PURE__ */ new Map(),
    /**
     * Register a toolbar action.
     * @param {string} name - Unique action name
     * @param {Object} config - Action configuration
     * @param {string} config.icon - Button icon
     * @param {string} config.label - Button label
     * @param {string} config.title - Tooltip text
     * @param {string} [config.className] - Additional CSS class
     * @param {Function} [config.onClick] - Click handler
     * @param {Array} [config.submenu] - Submenu items for dropdown
     */
    register(name, config4) {
      this.actions.set(name, { name, ...config4 });
    },
    /**
     * Get all registered actions.
     * @returns {Object[]} Array of action configs
     */
    getActions() {
      return [...this.actions.values()];
    },
    /**
     * Get registered actions for a specific zone.
     * @param {string} zone - Zone name ('left' or 'right')
     * @returns {Object[]} Array of action configs for that zone
     */
    getActionsForZone(zone) {
      return [...this.actions.values()].filter((a) => a.zone === zone);
    },
    /**
     * Create a button element from an action config.
     * @param {Object} config - Action configuration
     * @returns {HTMLButtonElement} The created button
     */
    createButton(config4) {
      const btn = document.createElement("button");
      btn.className = "editable-toolbar-button " + (config4.className || "");
      btn.setAttribute("aria-label", config4.label);
      btn.title = config4.title;
      setButtonContent(btn, config4.icon, config4.label);
      if (config4.disabled) {
        btn.disabled = true;
        btn.classList.add("toolbar-button-disabled");
      }
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!config4.disabled)
          config4.onClick(e);
      });
      return btn;
    },
    /**
     * Create a button with dropdown submenu.
     * @param {Object} config - Action configuration with submenu array
     * @returns {HTMLDivElement} Wrapper containing button and submenu
     */
    createSubmenuButton(config4) {
      const wrapper = document.createElement("div");
      wrapper.className = "editable-toolbar-submenu-wrapper";
      const btn = document.createElement("button");
      btn.className = "editable-toolbar-button " + (config4.className || "");
      btn.setAttribute("aria-label", config4.label);
      btn.setAttribute("aria-haspopup", "true");
      btn.setAttribute("aria-expanded", "false");
      btn.title = config4.title;
      setButtonContent(btn, config4.icon, config4.label);
      const submenu = document.createElement("div");
      submenu.className = "editable-toolbar-submenu";
      submenu.setAttribute("role", "menu");
      config4.submenu.forEach((itemConfig) => {
        const item = document.createElement("button");
        item.className = "editable-toolbar-submenu-item " + (itemConfig.className || "");
        item.setAttribute("role", "menuitem");
        item.title = itemConfig.title;
        setButtonContent(item, itemConfig.icon, itemConfig.label);
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          itemConfig.onClick(e);
          submenu.classList.remove("open");
          btn.setAttribute("aria-expanded", "false");
        });
        submenu.appendChild(item);
      });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = submenu.classList.toggle("open");
        btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      });
      wrapper.appendChild(btn);
      wrapper.appendChild(submenu);
      return wrapper;
    }
  };

  // src/undo.js
  var undoStack = [];
  var redoStack = [];
  var restoreArrowDOMFn = null;
  function registerRestoreArrowDOM(fn) {
    restoreArrowDOMFn = fn;
  }
  function captureAllState() {
    const snapshots = [];
    for (const [element, editableElt] of editableRegistry) {
      editableElt.syncFromDOM();
      snapshots.push({
        element,
        state: { ...editableElt.state }
      });
    }
    return snapshots;
  }
  var ARROW_STATE_KEYS = [
    "fromX",
    "fromY",
    "toX",
    "toY",
    "control1X",
    "control1Y",
    "control2X",
    "control2Y",
    "curveMode",
    "color",
    "width",
    "head",
    "dash",
    "line",
    "opacity"
  ];
  function captureArrowState() {
    const snapshots = [];
    for (const arrowData of NewElementRegistry.newArrows) {
      const state = {};
      for (const key of ARROW_STATE_KEYS) {
        state[key] = arrowData[key];
      }
      snapshots.push({
        arrowData,
        state
      });
    }
    return snapshots;
  }
  function restoreArrowState(snapshots) {
    for (const snapshot of snapshots) {
      const arrowData = snapshot.arrowData;
      for (const key of ARROW_STATE_KEYS) {
        arrowData[key] = snapshot.state[key];
      }
    }
    if (restoreArrowDOMFn)
      restoreArrowDOMFn(snapshots);
  }
  function restoreState(snapshots) {
    for (const snapshot of snapshots) {
      const editableElt = editableRegistry.get(snapshot.element);
      if (editableElt) {
        editableElt.setState(snapshot.state);
      }
    }
  }
  function pushUndoState() {
    const state = {
      elements: captureAllState(),
      arrows: captureArrowState()
    };
    undoStack.push(state);
    if (undoStack.length > CONFIG.MAX_UNDO_STACK_SIZE) {
      undoStack.shift();
    }
    redoStack.length = 0;
  }
  function undo() {
    if (undoStack.length === 0)
      return false;
    const currentState = {
      elements: captureAllState(),
      arrows: captureArrowState()
    };
    redoStack.push(currentState);
    const previousState = undoStack.pop();
    restoreState(previousState.elements);
    restoreArrowState(previousState.arrows);
    return true;
  }
  function redo() {
    if (redoStack.length === 0)
      return false;
    const currentState = {
      elements: captureAllState(),
      arrows: captureArrowState()
    };
    undoStack.push(currentState);
    const redoState = redoStack.pop();
    restoreState(redoState.elements);
    restoreArrowState(redoState.arrows);
    return true;
  }
  function canUndo() {
    return undoStack.length > 0;
  }
  function canRedo() {
    return redoStack.length > 0;
  }
  function setupUndoRedoKeyboard() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (document.activeElement.contentEditable === "true")
          return;
        e.preventDefault();
        if (undo()) {
          debug("Undo performed");
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "z" && e.shiftKey)) {
        if (document.activeElement.contentEditable === "true")
          return;
        e.preventDefault();
        if (redo()) {
          debug("Redo performed");
        }
        return;
      }
    });
  }

  // src/capabilities.js
  var Capabilities = {
    /**
     * Move capability - handles dragging elements to reposition them.
     */
    move: {
      name: "move",
      init(context) {
        context.isDragging = false;
        context.dragStartX = 0;
        context.dragStartY = 0;
        context.dragInitialX = 0;
        context.dragInitialY = 0;
      },
      attachEvents(context) {
        const { element, container } = context;
        const startDrag = (e) => {
          if (element.contentEditable === "true")
            return;
          const quillData = quillInstances.get(element);
          if (quillData && quillData.isEditing)
            return;
          if (e.target.classList.contains("resize-handle"))
            return;
          if (e.target.closest(".ql-toolbar") || e.target.closest(".quill-toolbar-container"))
            return;
          if (e.target.closest(".ql-picker") || e.target.classList.contains("ql-picker-item"))
            return;
          pushUndoState();
          context.cachedScale = getSlideScale();
          context.isDragging = true;
          const coords = getClientCoordinates(e, context.cachedScale);
          context.dragStartX = coords.clientX;
          context.dragStartY = coords.clientY;
          context.dragInitialX = container.offsetLeft;
          context.dragInitialY = container.offsetTop;
          e.preventDefault();
        };
        element.addEventListener("mousedown", startDrag);
        element.addEventListener("touchstart", startDrag);
        context.handlers.drag = startDrag;
      },
      onMove(context, e) {
        if (!context.isDragging)
          return;
        const coords = getClientCoordinates(e, context.cachedScale);
        const deltaX = coords.clientX - context.dragStartX;
        const deltaY = coords.clientY - context.dragStartY;
        context.container.style.left = context.dragInitialX + deltaX + "px";
        context.container.style.top = context.dragInitialY + deltaY + "px";
        e.preventDefault();
      },
      onStop(context) {
        context.isDragging = false;
      },
      isActive(context) {
        return context.isDragging;
      },
      handleKeyboard(context, e, editableElt) {
        if (e.shiftKey)
          return false;
        if (e.ctrlKey || e.metaKey)
          return false;
        const step = CONFIG.KEYBOARD_MOVE_STEP;
        const state = editableElt.getState();
        pushUndoState();
        switch (e.key) {
          case "ArrowRight":
            editableElt.setState({ x: state.x + step });
            return true;
          case "ArrowLeft":
            editableElt.setState({ x: state.x - step });
            return true;
          case "ArrowDown":
            editableElt.setState({ y: state.y + step });
            return true;
          case "ArrowUp":
            editableElt.setState({ y: state.y - step });
            return true;
        }
        return false;
      }
    },
    /**
     * Resize capability - handles resizing elements via corner handles.
     * Supports aspect ratio preservation with Shift key.
     */
    resize: {
      name: "resize",
      init(context) {
        context.isResizing = false;
        context.resizeHandle = null;
        context.resizeStartX = 0;
        context.resizeStartY = 0;
        context.resizeInitialWidth = 0;
        context.resizeInitialHeight = 0;
        context.resizeInitialX = 0;
        context.resizeInitialY = 0;
      },
      createHandles(context) {
        const { container } = context;
        const handles = ["nw", "ne", "sw", "se"];
        const handleLabels = {
          nw: "Resize from top-left corner",
          ne: "Resize from top-right corner",
          sw: "Resize from bottom-left corner",
          se: "Resize from bottom-right corner"
        };
        handles.forEach((position) => {
          const handle = document.createElement("div");
          handle.className = "resize-handle handle-" + position;
          handle.setAttribute("role", "slider");
          handle.setAttribute("aria-label", handleLabels[position]);
          handle.setAttribute("tabindex", "-1");
          handle.dataset.position = position;
          container.appendChild(handle);
        });
      },
      attachEvents(context) {
        const { container, element } = context;
        const startResize = (e) => {
          pushUndoState();
          context.cachedScale = getSlideScale();
          context.isResizing = true;
          context.resizeHandle = e.target.dataset.position;
          const coords = getClientCoordinates(e, context.cachedScale);
          context.resizeStartX = coords.clientX;
          context.resizeStartY = coords.clientY;
          context.resizeInitialWidth = element.offsetWidth;
          context.resizeInitialHeight = element.offsetHeight;
          context.resizeInitialX = container.offsetLeft;
          context.resizeInitialY = container.offsetTop;
          e.preventDefault();
          e.stopPropagation();
        };
        container.querySelectorAll(".resize-handle").forEach((handle) => {
          handle.addEventListener("mousedown", startResize);
          handle.addEventListener("touchstart", startResize);
        });
        context.handlers.resize = startResize;
      },
      onMove(context, e) {
        if (!context.isResizing)
          return;
        const { element, container } = context;
        const coords = getClientCoordinates(e, context.cachedScale);
        const deltaX = coords.clientX - context.resizeStartX;
        const deltaY = coords.clientY - context.resizeStartY;
        let newWidth = context.resizeInitialWidth;
        let newHeight = context.resizeInitialHeight;
        let newX = context.resizeInitialX;
        let newY = context.resizeInitialY;
        const preserveAspectRatio = e.shiftKey;
        const aspectRatio = context.resizeInitialWidth / context.resizeInitialHeight;
        const handle = context.resizeHandle;
        if (preserveAspectRatio) {
          if (handle.includes("e") || handle.includes("w")) {
            const widthChange = handle.includes("e") ? deltaX : -deltaX;
            newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialWidth + widthChange);
            newHeight = newWidth / aspectRatio;
          } else if (handle.includes("s") || handle.includes("n")) {
            const heightChange = handle.includes("s") ? deltaY : -deltaY;
            newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialHeight + heightChange);
            newWidth = newHeight * aspectRatio;
          }
          if (handle.includes("w")) {
            newX = context.resizeInitialX + (context.resizeInitialWidth - newWidth);
          }
          if (handle.includes("n")) {
            newY = context.resizeInitialY + (context.resizeInitialHeight - newHeight);
          }
        } else {
          if (handle.includes("e")) {
            newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialWidth + deltaX);
          }
          if (handle.includes("w")) {
            newWidth = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialWidth - deltaX);
            newX = context.resizeInitialX + (context.resizeInitialWidth - newWidth);
          }
          if (handle.includes("s")) {
            newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialHeight + deltaY);
          }
          if (handle.includes("n")) {
            newHeight = Math.max(CONFIG.MIN_ELEMENT_SIZE, context.resizeInitialHeight - deltaY);
            newY = context.resizeInitialY + (context.resizeInitialHeight - newHeight);
          }
        }
        element.style.width = newWidth + "px";
        element.style.height = newHeight + "px";
        container.style.left = newX + "px";
        container.style.top = newY + "px";
        e.preventDefault();
      },
      onStop(context) {
        context.isResizing = false;
        context.resizeHandle = null;
      },
      isActive(context) {
        return context.isResizing;
      },
      handleKeyboard(context, e, editableElt) {
        if (!e.shiftKey)
          return false;
        if (e.ctrlKey || e.metaKey)
          return false;
        const step = CONFIG.KEYBOARD_MOVE_STEP;
        const state = editableElt.getState();
        pushUndoState();
        switch (e.key) {
          case "ArrowRight":
            editableElt.setState({ width: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.width + step) });
            return true;
          case "ArrowLeft":
            editableElt.setState({ width: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.width - step) });
            return true;
          case "ArrowDown":
            editableElt.setState({ height: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.height + step) });
            return true;
          case "ArrowUp":
            editableElt.setState({ height: Math.max(CONFIG.MIN_ELEMENT_SIZE, state.height - step) });
            return true;
        }
        return false;
      }
    },
    /**
     * Font controls capability - creates container for edit button.
     * Actual formatting (font size, alignment, colors) is handled by Quill toolbar.
     */
    fontControls: {
      name: "fontControls",
      createControls(context) {
        const { container } = context;
        const fontControls = document.createElement("div");
        fontControls.className = "editable-font-controls";
        container.appendChild(fontControls);
        return fontControls;
      }
    },
    /**
     * Edit text capability - toggles contentEditable mode for divs.
     */
    editText: {
      name: "editText",
      createControls(context) {
        const { container, element } = context;
        const elementType = element.tagName.toLowerCase();
        let fontControls = container.querySelector(".editable-font-controls");
        if (!fontControls) {
          fontControls = document.createElement("div");
          fontControls.className = "editable-font-controls";
          container.appendChild(fontControls);
        }
        const config4 = ControlRegistry.controls.get("editMode");
        if (config4 && config4.appliesTo.includes(elementType)) {
          const btn = ControlRegistry.createButton(config4, element);
          fontControls.appendChild(btn);
          return btn;
        }
        return null;
      }
    },
    /**
     * Rotate capability - handles rotating elements via top handle.
     * Supports 15-degree snap with Shift key.
     * Keyboard: Ctrl/Cmd + arrow keys for rotation.
     */
    rotate: {
      name: "rotate",
      init(context) {
        context.isRotating = false;
        context.rotateStartAngle = 0;
        context.rotateInitialRotation = 0;
      },
      createHandles(context) {
        const { container } = context;
        const handle = document.createElement("div");
        handle.className = "rotate-handle";
        handle.setAttribute("role", "slider");
        handle.setAttribute("aria-label", "Rotate element");
        handle.setAttribute("tabindex", "-1");
        handle.title = "Rotate (Shift to snap to 15\xB0)";
        container.appendChild(handle);
      },
      attachEvents(context) {
        const { container } = context;
        const startRotate = (e) => {
          pushUndoState();
          context.isRotating = true;
          const rect = container.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          context.rotateCenterX = centerX;
          context.rotateCenterY = centerY;
          const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
          const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
          context.rotateStartAngle = Math.atan2(
            clientY - centerY,
            clientX - centerX
          );
          const editableElt = context.editableElt;
          context.rotateInitialRotation = editableElt.state.rotation || 0;
          e.preventDefault();
          e.stopPropagation();
        };
        const rotateHandle = container.querySelector(".rotate-handle");
        rotateHandle.addEventListener("mousedown", startRotate);
        rotateHandle.addEventListener("touchstart", startRotate);
        context.handlers.rotate = startRotate;
      },
      onMove(context, e) {
        if (!context.isRotating)
          return;
        const clientX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith("touch") ? e.touches[0].clientY : e.clientY;
        const currentAngle = Math.atan2(
          clientY - context.rotateCenterY,
          clientX - context.rotateCenterX
        );
        const angleDiff = (currentAngle - context.rotateStartAngle) * (180 / Math.PI);
        let newRotation = context.rotateInitialRotation + angleDiff;
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / CONFIG.ROTATE_SNAP_STEP) * CONFIG.ROTATE_SNAP_STEP;
        }
        while (newRotation > 180)
          newRotation -= 360;
        while (newRotation < -180)
          newRotation += 360;
        context.editableElt.setState({ rotation: newRotation });
        e.preventDefault();
      },
      onStop(context) {
        context.isRotating = false;
      },
      isActive(context) {
        return context.isRotating;
      },
      handleKeyboard(context, e, editableElt) {
        if (!e.ctrlKey && !e.metaKey)
          return false;
        const step = e.shiftKey ? CONFIG.ROTATE_SNAP_STEP : CONFIG.ROTATE_KEY_STEP;
        const state = editableElt.getState();
        pushUndoState();
        switch (e.key) {
          case "ArrowRight":
            editableElt.setState({ rotation: state.rotation + step });
            return true;
          case "ArrowLeft":
            editableElt.setState({ rotation: state.rotation - step });
            return true;
        }
        return false;
      }
    }
  };
  var ELEMENT_CAPABILITIES = {
    img: ["move", "resize", "rotate"],
    video: ["move", "resize", "rotate"],
    div: ["move", "resize", "rotate", "fontControls", "editText"],
    p: ["move", "resize", "rotate", "fontControls", "editText"]
  };
  var _capabilityOverrides = /* @__PURE__ */ new WeakMap();
  function setCapabilityOverride(el, capabilityNames) {
    _capabilityOverrides.set(el, capabilityNames);
  }
  function getCapabilitiesFor(elementType, el) {
    if (el && _capabilityOverrides.has(el)) {
      return _capabilityOverrides.get(el).map((name) => Capabilities[name]).filter(Boolean);
    }
    const capabilityNames = ELEMENT_CAPABILITIES[elementType] || ["move", "resize"];
    return capabilityNames.map((name) => Capabilities[name]).filter(Boolean);
  }

  // src/element-setup.js
  async function addNewTextElement() {
    const currentSlide = getCurrentSlide();
    if (!currentSlide) {
      console.warn("No current slide found");
      return null;
    }
    const newDiv = document.createElement("div");
    newDiv.className = "editable editable-new";
    newDiv.textContent = CONFIG.NEW_TEXT_CONTENT;
    newDiv.style.width = CONFIG.NEW_TEXT_WIDTH + "px";
    newDiv.style.minHeight = CONFIG.NEW_TEXT_HEIGHT + "px";
    currentSlide.appendChild(newDiv);
    initializeQuillForElement(newDiv);
    setupDraggableElt(newDiv);
    const slideIndex = getCurrentSlideIndex();
    const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");
    if (isOnNewSlide) {
      const newSlideEntry = NewElementRegistry.newSlides.find((s) => s.element === currentSlide);
      NewElementRegistry.addDiv(newDiv, slideIndex, newSlideEntry || null);
    } else {
      const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
      const originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
      NewElementRegistry.addDiv(newDiv, originalSlideIndex, null);
    }
    const editableElt = editableRegistry.get(newDiv);
    if (editableElt) {
      const slideWidth = currentSlide.offsetWidth || CONFIG.DEFAULT_SLIDE_WIDTH;
      const slideHeight = currentSlide.offsetHeight || CONFIG.DEFAULT_SLIDE_HEIGHT;
      editableElt.setState({
        x: (slideWidth - CONFIG.NEW_TEXT_WIDTH) / 2,
        y: (slideHeight - CONFIG.NEW_TEXT_HEIGHT) / 2
      });
    }
    debug("Added new text element to slide", slideIndex);
    return newDiv;
  }
  function addNewSlide() {
    const currentSlide = getCurrentSlide();
    if (!currentSlide) {
      console.warn("No current slide found");
      return null;
    }
    const slideIndex = getCurrentSlideIndex();
    const qmdHeadingIndex = getQmdHeadingIndex(slideIndex);
    let originalSlideIndex;
    let insertAfterNewSlide = null;
    const isOnNewSlide = currentSlide.classList.contains("editable-new-slide");
    if (isOnNewSlide) {
      const currentNewSlideEntry = NewElementRegistry.newSlides.find((s) => s.element === currentSlide);
      if (currentNewSlideEntry) {
        originalSlideIndex = currentNewSlideEntry.afterSlideIndex;
        insertAfterNewSlide = currentNewSlideEntry;
      } else {
        originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
      }
    } else {
      originalSlideIndex = qmdHeadingIndex - NewElementRegistry.countNewSlidesBefore(qmdHeadingIndex);
    }
    const newSlide = document.createElement("section");
    newSlide.className = "slide level2 editable-new-slide";
    const heading = document.createElement("h2");
    heading.textContent = "";
    newSlide.appendChild(heading);
    currentSlide.insertAdjacentElement("afterend", newSlide);
    NewElementRegistry.addSlide(newSlide, originalSlideIndex, insertAfterNewSlide);
    Reveal.sync();
    Reveal.next();
    debug("Added new slide after original index", originalSlideIndex);
    return newSlide;
  }
  function setupDraggableElt(elt) {
    const editableElt = new EditableElement(elt);
    editableRegistry.set(elt, editableElt);
    const container = createEltContainer(elt);
    editableElt.container = container;
    setupEltStyles(elt);
    const context = {
      element: elt,
      container,
      editableElt,
      handlers: {},
      rafId: null,
      cachedScale: 1
    };
    const elementType = elt.tagName.toLowerCase();
    const capabilities = getCapabilitiesFor(elementType, elt);
    capabilities.forEach((cap) => {
      if (cap.init)
        cap.init(context);
    });
    setupContainerAccessibility(container);
    capabilities.forEach((cap) => {
      if (cap.createHandles)
        cap.createHandles(context);
      if (cap.createControls)
        cap.createControls(context);
    });
    capabilities.forEach((cap) => {
      if (cap.attachEvents)
        cap.attachEvents(context);
    });
    setupHoverEffects(context, capabilities);
    setupKeyboardNavigation(context, capabilities, editableElt);
    attachGlobalEvents(context, capabilities);
    if (elementType === "img") {
      container.addEventListener("mousedown", () => setActiveImage(elt));
    }
  }
  function createEltContainer(elt) {
    const container = document.createElement("div");
    container.className = "editable-container";
    elt.parentNode.insertBefore(container, elt);
    container.appendChild(elt);
    return container;
  }
  function setupEltStyles(elt) {
    elt.style.cursor = "move";
    elt.style.position = "relative";
    let width = elt.offsetWidth;
    let height = elt.offsetHeight;
    if (elt.tagName.toLowerCase() === "img" && (width === 0 || height === 0)) {
      width = elt.naturalWidth || width;
      height = elt.naturalHeight || height;
    }
    if (elt.tagName.toLowerCase() === "video" && (width === 0 || height === 0)) {
      width = elt.videoWidth || width || 300;
      height = elt.videoHeight || height || 150;
    }
    if (!elt.style.width)
      elt.style.width = width + "px";
    if (!elt.style.height)
      elt.style.height = height + "px";
    elt.style.display = "block";
  }
  function setupContainerAccessibility(container) {
    container.setAttribute("tabindex", "0");
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "Editable element. Use arrow keys to move, Shift+arrows to resize.");
  }
  function setupHoverEffects(context, capabilities) {
    const { container } = context;
    const showControls = () => container.classList.add("active");
    const hideControls = () => container.classList.remove("active");
    const isAnyActive = () => capabilities.some((cap) => cap.isActive && cap.isActive(context));
    container.addEventListener("mouseenter", showControls);
    container.addEventListener("mouseleave", () => {
      if (!isAnyActive())
        hideControls();
    });
    container.addEventListener("focus", showControls);
    container.addEventListener("blur", (e) => {
      if (!container.contains(e.relatedTarget))
        hideControls();
    });
  }
  function setupKeyboardNavigation(context, capabilities, editableElt) {
    const { container, element } = context;
    container.addEventListener("keydown", (e) => {
      if (element.contentEditable === "true")
        return;
      if (e.key === "Tab" && e.shiftKey) {
        container.blur();
        e.preventDefault();
        return;
      }
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key))
        return;
      e.preventDefault();
      e.stopPropagation();
      editableElt.syncFromDOM();
      for (const cap of capabilities) {
        if (cap.handleKeyboard && cap.handleKeyboard(context, e, editableElt))
          break;
      }
    });
  }
  function attachGlobalEvents(context, capabilities) {
    const handlePointerMove = (e) => {
      if (!capabilities.some((cap) => cap.isActive && cap.isActive(context)))
        return;
      if (context.rafId)
        cancelAnimationFrame(context.rafId);
      context.rafId = requestAnimationFrame(() => {
        capabilities.forEach((cap) => {
          if (cap.onMove)
            cap.onMove(context, e);
        });
        context.rafId = null;
      });
    };
    const stopAction = () => {
      const wasActive = capabilities.some((cap) => cap.isActive && cap.isActive(context));
      if (wasActive) {
        setTimeout(() => {
          if (!context.container.matches(":hover"))
            context.container.classList.remove("active");
        }, CONFIG.HOVER_TIMEOUT);
      }
      if (context.rafId) {
        cancelAnimationFrame(context.rafId);
        context.rafId = null;
      }
      capabilities.forEach((cap) => {
        if (cap.onStop)
          cap.onStop(context);
      });
    };
    document.addEventListener("mousemove", handlePointerMove);
    document.addEventListener("touchmove", handlePointerMove);
    document.addEventListener("mouseup", stopAction);
    document.addEventListener("touchend", stopAction);
  }
  function setupImageWhenReady(img) {
    if (img.complete && img.naturalWidth > 0 && img.offsetWidth > 0) {
      setupDraggableElt(img);
      return;
    }
    let setupDone = false;
    const doSetup = () => {
      if (setupDone)
        return;
      if (img.naturalWidth > 0 && img.offsetWidth > 0) {
        setupDone = true;
        setupDraggableElt(img);
      }
    };
    img.addEventListener("load", doSetup, { once: true });
    let attempts = 0;
    const poll = () => {
      if (setupDone || attempts >= CONFIG.POLL_MAX_ATTEMPTS)
        return;
      attempts++;
      if (img.naturalWidth > 0 && img.offsetWidth > 0)
        doSetup();
      else
        setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
    };
    poll();
  }
  function setupDivWhenReady(div) {
    if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
      setupDraggableElt(div);
      return;
    }
    let setupDone = false;
    let attempts = 0;
    const checkAndSetup = () => {
      if (setupDone || attempts >= CONFIG.POLL_MAX_ATTEMPTS)
        return;
      attempts++;
      if (div.offsetWidth >= CONFIG.MIN_ELEMENT_SIZE && div.offsetHeight >= CONFIG.MIN_ELEMENT_SIZE) {
        setupDone = true;
        setupDraggableElt(div);
      } else {
        if (attempts < 10)
          requestAnimationFrame(checkAndSetup);
        else
          setTimeout(checkAndSetup, CONFIG.POLL_INTERVAL_MS);
      }
    };
    requestAnimationFrame(checkAndSetup);
  }
  function setupVideoWhenReady(video) {
    setupDraggableElt(video);
  }

  // src/serialization.js
  function findSlideHeadingLines(lines) {
    const headings = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const prevLine = i > 0 ? lines[i - 1].trim() : "";
      if (line.startsWith("## ") && (i === 0 || prevLine === "")) {
        headings.push(i);
      }
    }
    return headings;
  }
  var PropertySerializers = {
    // Core position/size properties (go in attribute list)
    width: {
      type: "attr",
      serialize: (v) => `width=${round(v)}px`
    },
    height: {
      type: "attr",
      serialize: (v) => `height=${round(v)}px`
    },
    left: {
      type: "attr",
      serialize: (v) => `left=${round(v)}px`
    },
    top: {
      type: "attr",
      serialize: (v) => `top=${round(v)}px`
    },
    // Style properties (go in style attribute)
    fontSize: {
      type: "style",
      serialize: (v) => v ? `font-size: ${v}px;` : null
    },
    textAlign: {
      type: "style",
      serialize: (v) => v ? `text-align: ${v};` : null
    },
    rotation: {
      type: "style",
      serialize: (v) => v ? `transform: rotate(${round(v)}deg);` : null
    },
    // Image-specific properties
    opacity: {
      type: "style",
      serialize: (v) => v !== 100 ? `opacity: ${Math.round(v / 100 * 1e3) / 1e3};` : null
    },
    borderRadius: {
      type: "style",
      serialize: (v) => v ? `border-radius: ${round(v)}px;` : null
    },
    cropTop: {
      type: "style",
      serialize: () => null
      // combined into crop serializer below
    },
    cropRight: {
      type: "style",
      serialize: () => null
    },
    cropBottom: {
      type: "style",
      serialize: () => null
    },
    cropLeft: {
      type: "style",
      serialize: () => null
    },
    flipH: {
      type: "style",
      serialize: () => null
      // combined into imageTransform
    },
    flipV: {
      type: "style",
      serialize: () => null
      // combined into imageTransform
    },
    imageTransform: {
      type: "style",
      serialize: (v) => v ? `transform: ${v};` : null
    }
  };
  function serializeToQmd(dimensions) {
    const attrs = [];
    const styles = [];
    const transformParts = [];
    if (dimensions.rotation) {
      transformParts.push(`rotate(${round(dimensions.rotation)}deg)`);
    }
    if (dimensions.flipH) {
      transformParts.push("scaleX(-1)");
    }
    if (dimensions.flipV) {
      transformParts.push("scaleY(-1)");
    }
    if (transformParts.length > 0) {
      styles.push(`transform: ${transformParts.join(" ")};`);
    }
    const { cropTop: ct, cropRight: cr, cropBottom: cb, cropLeft: cl } = dimensions;
    if (ct || cr || cb || cl) {
      styles.push(`clip-path: inset(${ct || 0}px ${cr || 0}px ${cb || 0}px ${cl || 0}px);`);
    }
    const skipKeys = /* @__PURE__ */ new Set(["rotation", "flipH", "flipV", "cropTop", "cropRight", "cropBottom", "cropLeft"]);
    for (const [key, value] of Object.entries(dimensions)) {
      if (skipKeys.has(key))
        continue;
      const serializer = PropertySerializers[key];
      if (serializer && value != null) {
        const result = serializer.serialize(value);
        if (result) {
          if (serializer.type === "style") {
            styles.push(result);
          } else {
            attrs.push(result);
          }
        }
      }
    }
    let str = `{.absolute ${attrs.join(" ")}`;
    if (styles.length > 0) {
      str += ` style="${styles.join(" ")}"`;
    }
    str += "}";
    return str;
  }
  function getFenceForContent(content) {
    const matches = content.match(/^:+/gm) || [];
    let maxColons = CONFIG.NEW_FENCE_LENGTH;
    for (const match2 of matches) {
      if (match2.length >= maxColons) {
        maxColons = match2.length + 1;
      }
    }
    return ":".repeat(maxColons);
  }
  function elementToText(element) {
    const quillEditor = element.querySelector(".ql-editor");
    let html = quillEditor ? quillEditor.innerHTML.trim() : element.innerHTML.trim();
    const tokens = [];
    const placeholder = (data) => {
      const idx = tokens.length;
      tokens.push(data);
      return `\0${idx}\0`;
    };
    html = html.replace(
      /<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>([^<]*)<\/span>/gi,
      (match2, colorVal, content) => {
        const colorOutput = getBrandColorOutput(colorVal.trim());
        return `[${content}]{style='background-color: ${colorOutput}'}`;
      }
    );
    html = html.replace(
      /<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>([^<]*)<\/span>/gi,
      (match2, colorVal, content) => {
        if (colorVal.trim().toLowerCase() === "inherit")
          return content;
        const colorOutput = getBrandColorOutput(colorVal.trim());
        return `[${content}]{style='color: ${colorOutput}'}`;
      }
    );
    html = html.replace(
      /<p[^>]*class="[^"]*ql-align-(center|right|justify)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
      (match2, align, content) => placeholder({ type: "align", align, content }) + "\n\n"
    );
    let text = html;
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<p[^>]*>/gi, "");
    text = text.replace(/<\/p>/gi, "\n\n");
    text = text.replace(/<code[^>]*>/gi, "`");
    text = text.replace(/<\/code>/gi, "`");
    text = text.replace(/<strong[^>]*>/gi, "**");
    text = text.replace(/<\/strong>/gi, "**");
    text = text.replace(/<b[^>]*>/gi, "**");
    text = text.replace(/<\/b>/gi, "**");
    text = text.replace(/<em[^>]*>/gi, "*");
    text = text.replace(/<\/em>/gi, "*");
    text = text.replace(/<i[^>]*>/gi, "*");
    text = text.replace(/<\/i>/gi, "*");
    text = text.replace(/<del[^>]*>/gi, "~~");
    text = text.replace(/<\/del>/gi, "~~");
    text = text.replace(/<s(?![a-z])[^>]*>/gi, "~~");
    text = text.replace(/<\/s(?![a-z])>/gi, "~~");
    text = text.replace(/<strike[^>]*>/gi, "~~");
    text = text.replace(/<\/strike>/gi, "~~");
    text = text.replace(/<u[^>]*>/gi, "[");
    text = text.replace(/<\/u>/gi, "]{.underline}");
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");
    text = text.replace(/<[^>]+>/g, "");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.replace(/\x00(\d+)\x00/g, (match2, idx) => {
      const token = tokens[parseInt(idx, 10)];
      if (token.type === "align") {
        const innerText = elementToText({ innerHTML: token.content, querySelector: () => null });
        const innerFence = getFenceForContent(innerText);
        return `${innerFence} {style="text-align: ${token.align}"}
${innerText}
${innerFence}`;
      }
      return match2;
    });
    text = text.replace(/__BRAND_SHORTCODE_(\w+)__/g, "{{< brand color $1 >}}");
    return text.trim();
  }
  function serializeArrowToShortcode(arrow) {
    const fromX = round(arrow.fromX);
    const fromY = round(arrow.fromY);
    const toX = round(arrow.toX);
    const toY = round(arrow.toY);
    let shortcode = `{{< arrow from="${fromX},${fromY}" to="${toX},${toY}"`;
    if (arrow.control1X !== null && arrow.control1Y !== null) {
      const c1x = round(arrow.control1X);
      const c1y = round(arrow.control1Y);
      shortcode += ` control1="${c1x},${c1y}"`;
    }
    if (arrow.control2X !== null && arrow.control2Y !== null) {
      const c2x = round(arrow.control2X);
      const c2y = round(arrow.control2Y);
      shortcode += ` control2="${c2x},${c2y}"`;
    }
    if (arrow.waypoints && arrow.waypoints.length > 0) {
      const waypointsStr = arrow.waypoints.map((wp) => `${round(wp.x)},${round(wp.y)}`).join(" ");
      shortcode += ` waypoints="${waypointsStr}"`;
      if (arrow.smooth) {
        shortcode += ` smooth="true"`;
      }
    }
    const normalizedArrowColor = normalizeColor(arrow.color);
    if (arrow.color && normalizedArrowColor !== "#000000") {
      const colorOutput = getBrandColorOutput(arrow.color);
      shortcode += ` color="${colorOutput}"`;
    }
    if (arrow.width && arrow.width !== CONFIG.ARROW_DEFAULT_WIDTH) {
      shortcode += ` width="${arrow.width}"`;
    }
    if (arrow.head && arrow.head !== "arrow") {
      shortcode += ` head="${arrow.head}"`;
    }
    if (arrow.dash && arrow.dash !== "solid") {
      shortcode += ` dash="${arrow.dash}"`;
    }
    if (arrow.line && arrow.line !== "single") {
      shortcode += ` line="${arrow.line}"`;
    }
    if (arrow.opacity !== void 0 && arrow.opacity !== 1) {
      shortcode += ` opacity="${arrow.opacity}"`;
    }
    if (arrow.label) {
      shortcode += ` label="${arrow.label}"`;
    }
    if (arrow.label && arrow.labelPosition && arrow.labelPosition !== "middle") {
      shortcode += ` label-position="${arrow.labelPosition}"`;
    }
    if (arrow.label && arrow.labelOffset !== void 0 && arrow.labelOffset !== CONFIG.ARROW_DEFAULT_LABEL_OFFSET) {
      shortcode += ` label-offset="${arrow.labelOffset}"`;
    }
    shortcode += ` position="absolute" >}}`;
    return shortcode;
  }
  function extractEditableEltDimensions() {
    const editableElements = getOriginalEditableElements();
    const dimensions = [];
    editableElements.forEach((elt) => {
      const editableElt = editableRegistry.get(elt);
      if (editableElt) {
        dimensions.push(editableElt.toDimensions());
      } else {
        const width = elt.style.width ? parseFloat(elt.style.width) : elt.offsetWidth;
        const height = elt.style.height ? parseFloat(elt.style.height) : elt.offsetHeight;
        const parentContainer = elt.parentNode;
        const left = parentContainer.style.left ? parseFloat(parentContainer.style.left) : parentContainer.offsetLeft;
        const top = parentContainer.style.top ? parseFloat(parentContainer.style.top) : parentContainer.offsetTop;
        dimensions.push({ width, height, left, top });
      }
    });
    return dimensions;
  }
  function insertNewSlides(text) {
    if (NewElementRegistry.newSlides.length === 0) {
      return { text, slideLinePositions: /* @__PURE__ */ new Map() };
    }
    const lines = text.split("\n");
    const slideHeadingLines = findSlideHeadingLines(lines);
    const divsByNewSlide = /* @__PURE__ */ new Map();
    for (const divInfo of NewElementRegistry.newDivs) {
      if (divInfo.newSlideRef) {
        if (!divsByNewSlide.has(divInfo.newSlideRef)) {
          divsByNewSlide.set(divInfo.newSlideRef, []);
        }
        divsByNewSlide.get(divInfo.newSlideRef).push(divInfo);
      }
    }
    const arrowsByNewSlide = /* @__PURE__ */ new Map();
    for (const arrowInfo of NewElementRegistry.newArrows) {
      if (arrowInfo.newSlideRef) {
        if (!arrowsByNewSlide.has(arrowInfo.newSlideRef)) {
          arrowsByNewSlide.set(arrowInfo.newSlideRef, []);
        }
        arrowsByNewSlide.get(arrowInfo.newSlideRef).push(arrowInfo);
      }
    }
    function flattenSlideTree(slides) {
      const childrenOf = /* @__PURE__ */ new Map();
      const roots = [];
      for (const slide of slides) {
        if (slide.insertAfterNewSlide && slides.includes(slide.insertAfterNewSlide)) {
          if (!childrenOf.has(slide.insertAfterNewSlide)) {
            childrenOf.set(slide.insertAfterNewSlide, []);
          }
          childrenOf.get(slide.insertAfterNewSlide).push(slide);
        } else {
          roots.push(slide);
        }
      }
      roots.sort((a, b) => b.insertionOrder - a.insertionOrder);
      for (const [, children] of childrenOf) {
        children.sort((a, b) => b.insertionOrder - a.insertionOrder);
      }
      const result = [];
      function visit(slide) {
        result.push(slide);
        const children = childrenOf.get(slide) || [];
        for (const child of children) {
          visit(child);
        }
      }
      for (const root2 of roots) {
        visit(root2);
      }
      return result;
    }
    const slidesByAfterIndex = /* @__PURE__ */ new Map();
    for (const slide of NewElementRegistry.newSlides) {
      const idx = slide.afterSlideIndex;
      if (!slidesByAfterIndex.has(idx)) {
        slidesByAfterIndex.set(idx, []);
      }
      slidesByAfterIndex.get(idx).push(slide);
    }
    const afterIndices = [...slidesByAfterIndex.keys()].sort((a, b) => b - a);
    const slideLinePositions = /* @__PURE__ */ new Map();
    for (const afterIdx of afterIndices) {
      const slidesForThisIndex = slidesByAfterIndex.get(afterIdx);
      const orderedSlides = flattenSlideTree(slidesForThisIndex);
      const targetHeadingIndex = afterIdx;
      let baseInsertLineIndex;
      if (targetHeadingIndex >= slideHeadingLines.length) {
        baseInsertLineIndex = lines.length;
      } else if (targetHeadingIndex + 1 < slideHeadingLines.length) {
        baseInsertLineIndex = slideHeadingLines[targetHeadingIndex + 1];
      } else {
        baseInsertLineIndex = lines.length;
      }
      for (let i = orderedSlides.length - 1; i >= 0; i--) {
        const newSlide = orderedSlides[i];
        const newSlideContent = ["", CONFIG.NEW_SLIDE_HEADING, ""];
        const divsForThisSlide = divsByNewSlide.get(newSlide) || [];
        for (const divInfo of divsForThisSlide) {
          const editableElt = editableRegistry.get(divInfo.element);
          if (editableElt) {
            const dims = editableElt.toDimensions();
            const attrStr = serializeToQmd(dims);
            const textContent = elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;
            const fence = getFenceForContent(textContent);
            newSlideContent.push("");
            newSlideContent.push(`${fence} ${attrStr}`);
            newSlideContent.push(textContent);
            newSlideContent.push(fence);
          }
        }
        const arrowsForThisSlide = arrowsByNewSlide.get(newSlide) || [];
        for (const arrowInfo of arrowsForThisSlide) {
          const shortcode = serializeArrowToShortcode(arrowInfo);
          newSlideContent.push("");
          newSlideContent.push(shortcode);
          newSlideContent.push("");
        }
        slideLinePositions.set(newSlide, baseInsertLineIndex + 1);
        lines.splice(baseInsertLineIndex, 0, ...newSlideContent);
        for (const [slide, pos] of slideLinePositions) {
          if (slide !== newSlide && pos >= baseInsertLineIndex) {
            slideLinePositions.set(slide, pos + newSlideContent.length);
          }
        }
      }
      const totalLinesAdded = orderedSlides.reduce((sum, slide) => {
        const divs = divsByNewSlide.get(slide) || [];
        const arrows = arrowsByNewSlide.get(slide) || [];
        return sum + 3 + divs.length * 4 + arrows.length * 3;
      }, 0);
      for (let j = 0; j < slideHeadingLines.length; j++) {
        if (slideHeadingLines[j] >= baseInsertLineIndex) {
          slideHeadingLines[j] += totalLinesAdded;
        }
      }
    }
    return { text: lines.join("\n"), slideLinePositions };
  }
  function insertContentBySlide(text, items, buildContent) {
    if (items.length === 0)
      return text;
    const lines = text.split("\n");
    const slideHeadingLines = findSlideHeadingLines(lines);
    const bySlide = /* @__PURE__ */ new Map();
    for (const item of items) {
      const idx = item.slideIndex;
      if (!bySlide.has(idx))
        bySlide.set(idx, []);
      bySlide.get(idx).push(item);
    }
    const slideIndices = [...bySlide.keys()].sort((a, b) => b - a);
    for (const slideIdx of slideIndices) {
      let insertLineIndex;
      if (slideIdx >= slideHeadingLines.length) {
        insertLineIndex = lines.length;
      } else if (slideIdx + 1 < slideHeadingLines.length) {
        insertLineIndex = slideHeadingLines[slideIdx + 1];
      } else {
        insertLineIndex = lines.length;
      }
      const newContent = buildContent(bySlide.get(slideIdx));
      if (newContent.length > 0) {
        lines.splice(insertLineIndex, 0, ...newContent);
        for (let i = 0; i < slideHeadingLines.length; i++) {
          if (slideHeadingLines[i] >= insertLineIndex) {
            slideHeadingLines[i] += newContent.length;
          }
        }
      }
    }
    return lines.join("\n");
  }
  function insertNewDivs(text) {
    const items = NewElementRegistry.newDivs.filter((div) => !div.newSlideRef);
    return insertContentBySlide(text, items, (divsForSlide) => {
      const newContent = [];
      for (const divInfo of divsForSlide) {
        const editableElt = editableRegistry.get(divInfo.element);
        if (editableElt) {
          const dims = editableElt.toDimensions();
          const attrStr = serializeToQmd(dims);
          const textContent = elementToText(divInfo.element) || CONFIG.NEW_TEXT_CONTENT;
          const fence = getFenceForContent(textContent);
          newContent.push("", `${fence} ${attrStr}`, textContent, fence);
        }
      }
      return newContent;
    });
  }
  function insertNewArrows(text) {
    const items = NewElementRegistry.newArrows.filter((arrow) => !arrow.newSlideRef);
    return insertContentBySlide(text, items, (arrowsForSlide) => {
      const newContent = [];
      for (const arrow of arrowsForSlide) {
        newContent.push("", serializeArrowToShortcode(arrow), "");
      }
      return newContent;
    });
  }
  function updateTextDivs(text) {
    const divs = getOriginalEditableDivs();
    const replacements = Array.from(divs).map(htmlToQuarto);
    const regex = /^(:{3,}) ?(?:\{\.editable[^}]*\}|editable)\n([\s\S]*?)\n\1$/gm;
    let index = 0;
    return text.replace(regex, (match2, fence, originalContent) => {
      const replacement = replacements[index++];
      if (replacement === null) {
        const contentFence = getFenceForContent(originalContent);
        return `${contentFence} {.editable}
${originalContent}
${contentFence}`;
      }
      return replacement || "";
    });
  }
  function htmlToQuarto(div) {
    const quillData = quillInstances.get(div);
    if (quillData && !quillData.isDirty) {
      return null;
    }
    const text = elementToText(div);
    const fence = getFenceForContent(text);
    return `${fence} {.editable}
` + text.trim() + `
${fence}`;
  }
  function replaceEditableOccurrences(text, replacements, srcReplacements = []) {
    const regex = /(?:^(:{3,}) |\]\(([^)]*)\))\{\.editable([^}]*)\}/gm;
    let index = 0;
    return text.replace(regex, (match2, fenceColons, originalSrc, extraAttrs) => {
      const isDiv = fenceColons !== void 0;
      const attrs = replacements[index] || "";
      const newSrc = srcReplacements[index] || null;
      index++;
      const extra = (extraAttrs || "").trim();
      const finalAttrs = extra ? attrs.replace(/^\{/, `{${extra} `) : attrs;
      if (isDiv) {
        return fenceColons + " " + finalAttrs;
      } else {
        return `](${newSrc ?? originalSrc})${finalAttrs}`;
      }
    });
  }
  function formatEditableEltStrings(dimensions) {
    return dimensions.map((dim) => serializeToQmd(dim));
  }
  function splitIntoSlideChunks(text) {
    let preamble = "";
    let body = text;
    if (text.startsWith("---\n")) {
      const closingIdx = text.indexOf("\n---\n", 4);
      if (closingIdx !== -1) {
        const end = closingIdx + 5;
        preamble = text.slice(0, end);
        body = text.slice(end);
      }
    }
    const parts = body.split(/(?=^## )/m);
    const firstIsSlide = parts[0].startsWith("## ");
    const preslide = firstIsSlide ? "" : parts[0];
    const slideChunks = firstIsSlide ? parts : parts.slice(1);
    return [preamble + preslide, ...slideChunks];
  }
  function applyModifiedSerializers(text, classifierRegistry) {
    return classifierRegistry.applySerializers(text);
  }

  // src/modify-mode.js
  var VALID_CLASS = "modify-mode-valid";
  var WARN_CLASS = "modify-mode-warn";
  var ROOT_CLASS = "modify-mode";
  var abortController = null;
  var _active = false;
  var _warnReasons = /* @__PURE__ */ new WeakMap();
  var _classifiers = [];
  var ModifyModeClassifier = {
    register(classifier) {
      _classifiers.push(classifier);
    },
    /**
     * Apply every registered classifier's serialize() to the QMD text.
     * This is the single write-back entry point for all modified element types.
     * @param {string} text - Full QMD source
     * @returns {string}
     */
    applySerializers(text) {
      for (const classifier of _classifiers) {
        if (typeof classifier.serialize === "function") {
          text = classifier.serialize(text);
        }
      }
      return text;
    }
  };
  function getImgSrc(img) {
    return img.getAttribute("src") || img.getAttribute("data-src") || null;
  }
  function srcInQmdSource(img) {
    if (!window._input_file)
      return false;
    const src = getImgSrc(img);
    return !!src && window._input_file.includes(src);
  }
  function getChunkPrefix(src) {
    const match2 = src.match(/figure-revealjs\/(.+)-\d+\.png$/);
    return match2 ? match2[1] : null;
  }
  function buildChunkPrefixCounts(imgs) {
    const counts = /* @__PURE__ */ new Map();
    for (const img of imgs) {
      const src = getImgSrc(img);
      if (!src)
        continue;
      const prefix = getChunkPrefix(src);
      if (prefix)
        counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
    return counts;
  }
  ModifyModeClassifier.register({
    label: "Images",
    classify(slideEl) {
      const imgs = Array.from(slideEl.querySelectorAll("img"));
      const prefixCounts = buildChunkPrefixCounts(imgs);
      const valid = [];
      const warn = [];
      for (const img of imgs) {
        if (editableRegistry.has(img))
          continue;
        if (img.classList.contains("absolute"))
          continue;
        if (img.closest("div.absolute"))
          continue;
        const src = getImgSrc(img);
        if (!src)
          continue;
        const prefix = getChunkPrefix(src);
        if (prefix) {
          if (prefixCounts.get(prefix) > 1) {
            warn.push({ el: img, reason: "Multi-figure chunk \u2014 cannot target individual figures" });
          }
        } else if (srcInQmdSource(img)) {
          valid.push(img);
        }
      }
      return { valid, warn };
    },
    activate(img) {
      const originalSrc = getImgSrc(img);
      if (!img.getAttribute("src") && img.getAttribute("data-src")) {
        img.src = img.getAttribute("data-src");
      }
      img.dataset.editableModifiedSrc = originalSrc;
      img.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
      img.dataset.editableModified = "true";
      setupImageWhenReady(img);
    },
    serialize(text) {
      const imgs = Array.from(
        document.querySelectorAll('img[data-editable-modified="true"]')
      );
      if (imgs.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const groups = /* @__PURE__ */ new Map();
      for (const img of imgs) {
        const originalSrc = img.dataset.editableModifiedSrc;
        if (!originalSrc)
          continue;
        if (!editableRegistry.has(img))
          continue;
        const slideIndex = parseInt(img.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        const key = `${chunkIndex}::${originalSrc}`;
        if (!groups.has(key))
          groups.set(key, { chunkIndex, originalSrc, imgs: [] });
        groups.get(key).imgs.push(img);
      }
      for (const { chunkIndex, originalSrc, imgs: groupImgs } of groups.values()) {
        groupImgs.sort(
          (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        const replacements = groupImgs.map((img) => {
          const dims = editableRegistry.get(img).toDimensions();
          return `](${dims.src || originalSrc})${serializeToQmd(dims)}`;
        });
        const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\]\\(${escapedSrc}\\)(\\{[^}]*\\})?`, "g");
        let occurrence = 0;
        chunks[chunkIndex] = chunks[chunkIndex].replace(
          regex,
          (match2) => occurrence < replacements.length ? replacements[occurrence++] : match2
        );
      }
      return chunks.join("");
    }
  });
  function getVideoSrc(video) {
    return video.getAttribute("src") || video.getAttribute("data-src") || video.querySelector("source")?.getAttribute("src") || null;
  }
  function videoSrcInQmdSource(video) {
    if (!window._input_file)
      return false;
    const src = getVideoSrc(video);
    return !!src && window._input_file.includes(src);
  }
  var _videosWithControlsRemoved = /* @__PURE__ */ new Set();
  ModifyModeClassifier.register({
    label: "Videos",
    classify(slideEl) {
      for (const video of _videosWithControlsRemoved) {
        video.setAttribute("controls", "");
      }
      _videosWithControlsRemoved.clear();
      const videos = Array.from(slideEl.querySelectorAll("video"));
      const valid = [];
      const warn = [];
      for (const video of videos) {
        if (editableRegistry.has(video))
          continue;
        if (video.classList.contains("absolute"))
          continue;
        if (video.closest("div.absolute"))
          continue;
        const src = getVideoSrc(video);
        if (!src)
          continue;
        if (videoSrcInQmdSource(video)) {
          valid.push(video);
        }
      }
      for (const video of valid) {
        video.removeAttribute("controls");
        _videosWithControlsRemoved.add(video);
      }
      return { valid, warn };
    },
    cleanup() {
      for (const video of _videosWithControlsRemoved) {
        video.setAttribute("controls", "");
      }
      _videosWithControlsRemoved.clear();
    },
    activate(video) {
      _videosWithControlsRemoved.delete(video);
      const originalSrc = getVideoSrc(video);
      if (!video.getAttribute("src") && video.getAttribute("data-src")) {
        video.src = video.getAttribute("data-src");
      }
      video.dataset.editableModifiedSrc = originalSrc;
      video.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
      video.dataset.editableModified = "true";
      video.style.maxWidth = "none";
      video.style.maxHeight = "none";
      setupVideoWhenReady(video);
    },
    serialize(text) {
      const videos = Array.from(
        document.querySelectorAll('video[data-editable-modified="true"]')
      );
      if (videos.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const groups = /* @__PURE__ */ new Map();
      for (const video of videos) {
        const originalSrc = video.dataset.editableModifiedSrc;
        if (!originalSrc)
          continue;
        if (!editableRegistry.has(video))
          continue;
        const slideIndex = parseInt(video.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        const key = `${chunkIndex}::${originalSrc}`;
        if (!groups.has(key))
          groups.set(key, { chunkIndex, originalSrc, videos: [] });
        groups.get(key).videos.push(video);
      }
      for (const { chunkIndex, originalSrc, videos: groupVideos } of groups.values()) {
        groupVideos.sort(
          (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        const replacements = groupVideos.map((video) => {
          const dims = editableRegistry.get(video).toDimensions();
          return `](${dims.src || originalSrc})${serializeToQmd(dims)}`;
        });
        const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\]\\(${escapedSrc}\\)(\\{[^}]*\\})?`, "g");
        let occurrence = 0;
        chunks[chunkIndex] = chunks[chunkIndex].replace(
          regex,
          (match2) => occurrence < replacements.length ? replacements[occurrence++] : match2
        );
      }
      return chunks.join("");
    }
  });
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function getAbsolutePosition(el) {
    const s = el.style;
    const left = s.left ? parseFloat(s.left) : null;
    const top = s.top ? parseFloat(s.top) : null;
    const width = s.width ? parseFloat(s.width) : null;
    const height = s.height ? parseFloat(s.height) : null;
    if (left === null || top === null || width === null || height === null)
      return null;
    return { left, top, width, height };
  }
  function makeAbsoluteBlockRegex(left, top, width, height) {
    const vals = [
      `left=${Math.round(left)}px`,
      `top=${Math.round(top)}px`,
      `width=${Math.round(width)}px`,
      `height=${Math.round(height)}px`
    ];
    const lookaheads = vals.map((v) => `(?=[^}]*${escapeRegex(v)})`).join("");
    return new RegExp(`\\{${lookaheads}\\.absolute[^}]*\\}`, "g");
  }
  function absoluteDivInQmdSource(div, slideIndex) {
    if (!window._input_file)
      return false;
    const pos = getAbsolutePosition(div);
    if (!pos)
      return false;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[getQmdHeadingIndex(slideIndex) + 1];
    if (!chunk)
      return false;
    return makeAbsoluteBlockRegex(pos.left, pos.top, pos.width, pos.height).test(chunk);
  }
  function waitForRegistryThenFixPosition(el, origLeft, origTop) {
    if (editableRegistry.has(el)) {
      editableRegistry.get(el).setState({ x: origLeft, y: origTop });
    } else {
      requestAnimationFrame(() => waitForRegistryThenFixPosition(el, origLeft, origTop));
    }
  }
  ModifyModeClassifier.register({
    label: "Positioned divs",
    classify(slideEl) {
      const slideIndex = Reveal.getState().indexh;
      const divs = Array.from(slideEl.querySelectorAll("div.absolute"));
      const valid = [];
      const warn = [];
      for (const div of divs) {
        if (editableRegistry.has(div))
          continue;
        if (div.classList.contains("editable-container"))
          continue;
        if (div.classList.contains("editable-new"))
          continue;
        if (div.classList.contains("editable"))
          continue;
        const pos = getAbsolutePosition(div);
        if (!pos) {
          warn.push({ el: div, reason: "No inline position \u2014 cannot match to source" });
          continue;
        }
        if (!absoluteDivInQmdSource(div, slideIndex)) {
          warn.push({ el: div, reason: "Cannot locate matching {.absolute} block in source" });
          continue;
        }
        valid.push(div);
      }
      return { valid, warn };
    },
    activate(el) {
      const pos = getAbsolutePosition(el);
      if (!pos)
        return;
      el.dataset.editableModified = "true";
      el.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
      el.dataset.editableModifiedAbsLeft = String(Math.round(pos.left));
      el.dataset.editableModifiedAbsTop = String(Math.round(pos.top));
      el.dataset.editableModifiedAbsWidth = String(Math.round(pos.width));
      el.dataset.editableModifiedAbsHeight = String(Math.round(pos.height));
      el.style.left = "";
      el.style.top = "";
      setupDivWhenReady(el);
      waitForRegistryThenFixPosition(el, pos.left, pos.top);
    },
    serialize(text) {
      const divs = Array.from(
        document.querySelectorAll("div[data-editable-modified-abs-left]")
      );
      if (divs.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const groups = /* @__PURE__ */ new Map();
      for (const div of divs) {
        if (!editableRegistry.has(div))
          continue;
        const slideIndex = parseInt(div.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!groups.has(chunkIndex))
          groups.set(chunkIndex, []);
        groups.get(chunkIndex).push(div);
      }
      for (const [chunkIndex, groupDivs] of groups) {
        groupDivs.sort(
          (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        const occurrenceCounters = /* @__PURE__ */ new Map();
        for (const div of groupDivs) {
          const origLeft = parseInt(div.dataset.editableModifiedAbsLeft, 10);
          const origTop = parseInt(div.dataset.editableModifiedAbsTop, 10);
          const origWidth = parseInt(div.dataset.editableModifiedAbsWidth, 10);
          const origHeight = parseInt(div.dataset.editableModifiedAbsHeight, 10);
          const sig = `${origLeft},${origTop},${origWidth},${origHeight}`;
          const targetOccurrence = occurrenceCounters.get(sig) ?? 0;
          occurrenceCounters.set(sig, targetOccurrence + 1);
          const regex = makeAbsoluteBlockRegex(origLeft, origTop, origWidth, origHeight);
          const dims = editableRegistry.get(div).toDimensions();
          const replacement = serializeToQmd(dims);
          let occurrence = 0;
          chunks[chunkIndex] = chunks[chunkIndex].replace(regex, (match2) => {
            if (occurrence++ === targetOccurrence)
              return replacement;
            return match2;
          });
        }
      }
      return chunks.join("");
    }
  });
  function makeAbsoluteImageRegex(src, left, top, width, height) {
    const escapedSrc = escapeRegex(src);
    const vals = [
      `left=${Math.round(left)}px`,
      `top=${Math.round(top)}px`,
      `width=${Math.round(width)}px`,
      `height=${Math.round(height)}px`
    ];
    const lookaheads = vals.map((v) => `(?=[^}]*${escapeRegex(v)})`).join("");
    return new RegExp(`\\]\\(${escapedSrc}\\)\\{${lookaheads}\\.absolute[^}]*\\}`, "g");
  }
  function absoluteImgInQmdSource(img, slideIndex) {
    if (!window._input_file)
      return false;
    const pos = getAbsolutePosition(img);
    if (!pos)
      return false;
    const src = getImgSrc(img);
    if (!src)
      return false;
    const chunks = splitIntoSlideChunks(window._input_file);
    const chunk = chunks[getQmdHeadingIndex(slideIndex) + 1];
    if (!chunk)
      return false;
    return makeAbsoluteImageRegex(src, pos.left, pos.top, pos.width, pos.height).test(chunk);
  }
  ModifyModeClassifier.register({
    label: "Positioned images",
    classify(slideEl) {
      const slideIndex = Reveal.getState().indexh;
      const imgs = Array.from(slideEl.querySelectorAll("img.absolute"));
      const valid = [];
      const warn = [];
      for (const img of imgs) {
        if (editableRegistry.has(img))
          continue;
        const pos = getAbsolutePosition(img);
        if (!pos) {
          warn.push({ el: img, reason: "No inline position \u2014 cannot match to source" });
          continue;
        }
        if (!absoluteImgInQmdSource(img, slideIndex)) {
          warn.push({ el: img, reason: "Cannot locate matching {.absolute} block in source" });
          continue;
        }
        valid.push(img);
      }
      return { valid, warn };
    },
    activate(el) {
      const pos = getAbsolutePosition(el);
      if (!pos)
        return;
      el.dataset.editableModifiedAbsLeft = String(Math.round(pos.left));
      el.dataset.editableModifiedAbsTop = String(Math.round(pos.top));
      el.dataset.editableModifiedAbsWidth = String(Math.round(pos.width));
      el.dataset.editableModifiedAbsHeight = String(Math.round(pos.height));
      el.dataset.editableModifiedAbsSrc = getImgSrc(el) ?? "";
      el.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
      if (!el.getAttribute("src") && el.getAttribute("data-src")) {
        el.src = el.getAttribute("data-src");
      }
      el.style.left = "";
      el.style.top = "";
      el.style.maxWidth = "none";
      el.style.maxHeight = "none";
      setupImageWhenReady(el);
      waitForRegistryThenFixPosition(el, pos.left, pos.top);
    },
    serialize(text) {
      const imgs = Array.from(
        document.querySelectorAll("img[data-editable-modified-abs-src]")
      );
      if (imgs.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const groups = /* @__PURE__ */ new Map();
      for (const img of imgs) {
        if (!editableRegistry.has(img))
          continue;
        const slideIndex = parseInt(img.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!groups.has(chunkIndex))
          groups.set(chunkIndex, []);
        groups.get(chunkIndex).push(img);
      }
      for (const [chunkIndex, groupImgs] of groups) {
        groupImgs.sort(
          (a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
        );
        for (const img of groupImgs) {
          const src = img.dataset.editableModifiedAbsSrc;
          const origLeft = parseInt(img.dataset.editableModifiedAbsLeft, 10);
          const origTop = parseInt(img.dataset.editableModifiedAbsTop, 10);
          const origWidth = parseInt(img.dataset.editableModifiedAbsWidth, 10);
          const origHeight = parseInt(img.dataset.editableModifiedAbsHeight, 10);
          const regex = makeAbsoluteImageRegex(src, origLeft, origTop, origWidth, origHeight);
          const dims = editableRegistry.get(img).toDimensions();
          const replacement = `](${src}){.absolute left=${dims.left}px top=${dims.top}px width=${dims.width}px height=${dims.height}px}`;
          chunks[chunkIndex] = chunks[chunkIndex].replace(regex, replacement);
        }
      }
      return chunks.join("");
    }
  });
  function headingHtmlToMarkdown(html) {
    let text = html;
    text = text.replace(
      /<span[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      (_, colorVal, content) => `[${content}]{style='background-color: ${getBrandColorOutput(colorVal.trim())}'}`
    );
    text = text.replace(
      /<span[^>]*style="[^"]*(?<!background-)color:\s*([^;"]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
      (_, colorVal, content) => {
        if (colorVal.trim().toLowerCase() === "inherit")
          return content;
        return `[${content}]{style='color: ${getBrandColorOutput(colorVal.trim())}'}`;
      }
    );
    text = text.replace(
      /<font[^>]*\bcolor="([^"]+)"[^>]*>([\s\S]*?)<\/font>/gi,
      (_, colorVal, content) => `[${content}]{style='color: ${getBrandColorOutput(colorVal.trim())}'}`
    );
    return text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**").replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**").replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*").replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*").replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, "~~$1~~").replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, "~~$1~~").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
  }
  function buildColorPicker(execCmd, title, pickerClass, presetColors) {
    let savedRange = null;
    const saveSelection = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount)
        savedRange = sel.getRangeAt(0).cloneRange();
    };
    const restoreSelection = () => {
      if (!savedRange)
        return;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    };
    const isForeground = execCmd === "foreColor";
    const iconSvg = isForeground ? '<svg viewbox="0 0 18 18"><line class="ql-color-label ql-stroke ql-transparent" x1="3" x2="15" y1="15" y2="15"/><polyline class="ql-stroke" points="5.5 11 9 3 12.5 11"/><line class="ql-stroke" x1="11.63" x2="6.38" y1="9" y2="9"/></svg>' : '<svg viewbox="0 0 18 18"><g class="ql-fill ql-color-label"><polygon points="6 6.868 6 6 5 6 5 7 5.942 7 6 6.868"/><rect height="1" width="1" x="4" y="4"/><polygon points="6.817 5 6 5 6 6 6.38 6 6.817 5"/><rect height="1" width="1" x="2" y="6"/><rect height="1" width="1" x="3" y="5"/><polygon points="11.183 5 11.62 6 12 6 12 5 11.183 5"/><rect height="1" width="1" x="11" y="4"/><polygon points="12 6.868 12.058 7 13 7 13 6 12 6 12 6.868"/><rect height="1" width="1" x="13" y="6"/><rect height="1" width="1" x="14" y="4"/><polygon points="14 5 13.367 5 13.82 6 14 6 14 5"/><rect height="1" width="1" x="14" y="7"/><rect height="1" width="1" x="14" y="2"/><rect height="1" width="1" x="13" y="3"/><polygon points="12 3.132 12 3 11 3 11 4 11.183 4 12 3.132"/><rect height="1" width="1" x="10" y="2"/><rect height="1" width="1" x="9" y="3"/><rect height="1" width="1" x="8" y="2"/><rect height="1" width="1" x="7" y="3"/><rect height="1" width="1" x="6" y="2"/><rect height="1" width="1" x="5" y="3"/><polygon points="3.917 5 4 5 4 6 4.075 6 3.917 5"/><rect height="1" width="1" x="3" y="7"/><rect height="1" width="1" x="2" y="4"/></g><rect class="ql-stroke" height="12" rx="1" ry="1" width="12" x="3" y="3"/></svg>';
    const label = document.createElement("span");
    label.className = "ql-picker-label";
    label.title = title;
    label.innerHTML = iconSvg;
    const options = document.createElement("span");
    options.className = "ql-picker-options";
    options.style.display = "none";
    const addItem = (value, bg) => {
      const item = document.createElement("span");
      item.className = "ql-picker-item";
      item.dataset.value = value;
      if (bg)
        item.style.backgroundColor = bg;
      options.appendChild(item);
      return item;
    };
    addItem("unset");
    for (const color of presetColors)
      addItem(color, color);
    const customInput = document.createElement("input");
    customInput.type = "color";
    customInput.style.cssText = "position:absolute;visibility:hidden;width:0;height:0;";
    const updateSwatch = (color) => {
      const swatchEl = label.querySelector(".ql-color-label");
      if (swatchEl)
        swatchEl.style[isForeground ? "stroke" : "fill"] = color || "";
    };
    customInput.addEventListener("input", () => {
      restoreSelection();
      document.execCommand(execCmd, false, customInput.value);
      updateSwatch(customInput.value);
    });
    addItem("custom");
    const picker = document.createElement("span");
    picker.className = `ql-picker ql-color-picker ${pickerClass}`;
    picker.appendChild(label);
    picker.appendChild(options);
    picker.appendChild(customInput);
    label.addEventListener("mousedown", (e) => {
      e.preventDefault();
      saveSelection();
      const isOpen = picker.classList.contains("ql-expanded");
      picker.closest(".heading-edit-toolbar")?.querySelectorAll(".ql-expanded").forEach((p) => {
        p.classList.remove("ql-expanded");
        p.querySelector(".ql-picker-options").style.display = "none";
      });
      if (!isOpen) {
        picker.classList.add("ql-expanded");
        options.style.display = "flex";
      }
    });
    options.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const item = e.target.closest(".ql-picker-item");
      if (!item)
        return;
      picker.classList.remove("ql-expanded");
      options.style.display = "none";
      const value = item.dataset.value;
      if (value === "custom") {
        customInput.click();
        return;
      }
      restoreSelection();
      if (value === "unset") {
        document.execCommand(execCmd, false, "inherit");
        updateSwatch("");
      } else {
        document.execCommand(execCmd, false, value);
        updateSwatch(value);
      }
    });
    return picker;
  }
  function buildHeadingToolbar(h2) {
    const toolbar = document.createElement("div");
    toolbar.className = "heading-edit-toolbar quill-toolbar-container ql-toolbar ql-snow";
    const buttons = [
      { command: "bold", label: "B", title: "Bold", style: "font-weight:bold" },
      { command: "italic", label: "I", title: "Italic", style: "font-style:italic" },
      { command: "underline", label: "U", title: "Underline", style: "text-decoration:underline" },
      { command: "strikeThrough", label: "S", title: "Strikethrough", style: "text-decoration:line-through" }
    ];
    for (const { command, label, title, style } of buttons) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.title = title;
      btn.style.cssText = style;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.execCommand(command);
      });
      toolbar.appendChild(btn);
    }
    const presetColors = getColorPalette();
    toolbar.appendChild(buildColorPicker("foreColor", "Text color", "ql-color", presetColors));
    toolbar.appendChild(buildColorPicker("backColor", "Background color", "ql-background", presetColors));
    const onDocMouseDown = (e) => {
      if (!toolbar.contains(e.target)) {
        toolbar.querySelectorAll(".ql-expanded").forEach((p) => {
          p.classList.remove("ql-expanded");
          p.querySelector(".ql-picker-options").style.display = "none";
        });
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    toolbar._cleanup = () => document.removeEventListener("mousedown", onDocMouseDown);
    return toolbar;
  }
  ModifyModeClassifier.register({
    label: "Slide titles",
    classify(slideEl) {
      const h2 = slideEl.querySelector("h2");
      if (!h2)
        return { valid: [], warn: [] };
      if (h2.classList.contains("editable-heading-active"))
        return { valid: [], warn: [] };
      return { valid: [h2], warn: [] };
    },
    activate(h2) {
      if (h2.classList.contains("editable-heading-active"))
        return true;
      h2.dataset.editableModifiedHeading = "true";
      h2.dataset.editableModifiedSlide = String(Reveal.getState().indexh);
      h2.dataset.editableModifiedOriginalHtml = h2.innerHTML;
      h2.classList.add("editable-heading-active");
      exitModifyMode({ resetPanel: false });
      h2.contentEditable = "true";
      h2.focus();
      const range = document.createRange();
      range.selectNodeContents(h2);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const toolbar = buildHeadingToolbar(h2);
      const textPanel = document.querySelector(".toolbar-panel-text");
      if (textPanel)
        textPanel.appendChild(toolbar);
      showRightPanel("text");
      const onKeyDown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          h2.blur();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          h2.innerHTML = h2.dataset.editableModifiedOriginalHtml;
          h2.blur();
        }
      };
      h2.addEventListener("keydown", onKeyDown);
      h2.addEventListener("blur", () => {
        h2.removeEventListener("keydown", onKeyDown);
        h2.contentEditable = "false";
        h2.classList.remove("editable-heading-active");
        toolbar._cleanup?.();
        toolbar.remove();
        showRightPanel("default");
      }, { once: true });
      return true;
    },
    serialize(text) {
      const headings = Array.from(
        document.querySelectorAll('h2[data-editable-modified-heading="true"]')
      );
      if (!headings.length)
        return text;
      const chunks = splitIntoSlideChunks(text);
      for (const h2 of headings) {
        const slideIndex = parseInt(h2.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        const newText = headingHtmlToMarkdown(h2.innerHTML);
        chunks[chunkIndex] = chunks[chunkIndex].replace(/^## .*/m, `## ${newText}`);
      }
      return chunks.join("");
    }
  });
  var CALLOUT_TYPES = ["callout-note", "callout-tip", "callout-warning", "callout-important", "callout-caution"];
  function parseFencedDivOpens(chunk) {
    const lines = chunk.split("\n");
    const result = [];
    const stack = [];
    for (let i = 0; i < lines.length; i++) {
      const match2 = lines[i].match(/^(:{3,})\s*(\{([^}]*)\})?\s*$/);
      if (!match2)
        continue;
      const fenceLen = match2[1].length;
      const hasBraces = match2[2] !== void 0;
      const attrsStr = match2[3] || "";
      if (!hasBraces && stack.length > 0 && fenceLen >= stack[stack.length - 1].fenceLen) {
        const top = stack.pop();
        if (top.resultIdx !== void 0)
          result[top.resultIdx].closeLineIndex = i;
        continue;
      }
      const classes = (attrsStr.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g) || []).map((c) => c.slice(1));
      const idMatch = attrsStr.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/);
      const matchKey = classes.length > 0 ? `.${classes[0]}` : idMatch ? `#${idMatch[1]}` : null;
      const entry = { lineIndex: i, closeLineIndex: -1, matchKey, fenceStr: match2[1], attrsStr, depth: stack.length };
      const resultIdx = result.length;
      result.push(entry);
      stack.push({ fenceLen, resultIdx });
    }
    return result.filter((e) => e.depth === 0);
  }
  function getFencedDivIdentifier(div) {
    const classes = Array.from(div.classList);
    if (classes.includes("columns"))
      return { key: ".columns", type: "columns" };
    for (const ct of CALLOUT_TYPES) {
      if (classes.includes(ct))
        return { key: `.${ct}`, type: "callout" };
    }
    const knownInternal = /* @__PURE__ */ new Set([
      "callout",
      "callout-style-default",
      "callout-captioned",
      "callout-titled",
      "column",
      "columns",
      "fragment",
      "current-fragment",
      "visible",
      "fade-in",
      "fade-out",
      "fade-up",
      "fade-down",
      "fade-left",
      "fade-right",
      "absolute",
      "editable",
      "editable-container",
      "editable-new",
      "editable-heading-active",
      "modify-mode-valid",
      "modify-mode-warn",
      "r-fit-text",
      "r-stretch",
      "r-frame",
      "r-hstack",
      "r-vstack",
      "slide-background",
      "slide-background-content",
      // Code-block wrappers handled by the Code blocks classifier.
      "sourceCode",
      "code-copy-outer-scaffold",
      "code-with-copy",
      "numberSource"
    ]);
    const userClass = classes.find((c) => !knownInternal.has(c));
    if (userClass)
      return { key: `.${userClass}`, type: "classed" };
    if (div.id)
      return { key: `#${div.id}`, type: "id-keyed" };
    return { key: null, type: "classless" };
  }
  function buildFenceLineWithAbsolute(originalLine, dims) {
    const match2 = originalLine.match(/^(:{3,})\s*(?:\{([^}]*)\})?\s*$/);
    if (!match2)
      return originalLine;
    const fence = match2[1];
    const existingAttrs = (match2[2] || "").trim();
    const posAttrs = [
      `left=${Math.round(dims.left)}px`,
      `top=${Math.round(dims.top)}px`,
      `width=${Math.round(dims.width)}px`,
      `height=${Math.round(dims.height)}px`
    ];
    const styleAttrs = [];
    if (dims.rotation)
      styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
    let newAttrs = existingAttrs ? `${existingAttrs} ` : "";
    newAttrs += `.absolute ${posAttrs.join(" ")}`;
    if (styleAttrs.length > 0)
      newAttrs += ` style="${styleAttrs.join(" ")}"`;
    return `${fence} {${newAttrs}}`;
  }
  ModifyModeClassifier.register({
    label: "Fenced divs",
    classify(slideEl) {
      if (!window._input_file)
        return { valid: [], warn: [] };
      const slideIndex = Reveal.getState().indexh;
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      const chunks = splitIntoSlideChunks(window._input_file);
      const chunk = chunks[chunkIndex];
      if (!chunk)
        return { valid: [], warn: [] };
      const fencedOpens = parseFencedDivOpens(chunk);
      if (fencedOpens.length === 0)
        return { valid: [], warn: [] };
      const candidates = Array.from(slideEl.children).filter(
        (el) => el.tagName === "DIV" && !editableRegistry.has(el) && !el.classList.contains("editable-container") && !el.classList.contains("editable-new") && !el.classList.contains("editable") && !el.classList.contains("absolute")
      );
      const valid = [];
      const warn = [];
      const usedFenceIndices = /* @__PURE__ */ new Set();
      const positionalFences = fencedOpens.map((fo, i) => ({ fo, i })).filter(({ fo }) => fo.matchKey === null);
      let positionalCursor = 0;
      for (const div of candidates) {
        const ident = getFencedDivIdentifier(div);
        if (!ident)
          continue;
        let fenceIdx = -1;
        if (ident.key !== null) {
          fenceIdx = fencedOpens.findIndex((fo, i) => !usedFenceIndices.has(i) && fo.matchKey === ident.key);
        } else {
          while (positionalCursor < positionalFences.length && usedFenceIndices.has(positionalFences[positionalCursor].i)) {
            positionalCursor++;
          }
          if (positionalCursor < positionalFences.length) {
            fenceIdx = positionalFences[positionalCursor].i;
          }
        }
        if (fenceIdx === -1)
          continue;
        usedFenceIndices.add(fenceIdx);
        div.dataset.editableModifiedFenceIdx = String(fenceIdx);
        div.dataset.editableModifiedFenceType = ident.type;
        valid.push(div);
      }
      return { valid, warn };
    },
    activate(div) {
      const slideIndex = Reveal.getState().indexh;
      div.dataset.editableModifiedFence = "true";
      div.dataset.editableModifiedSlide = String(slideIndex);
      const slideEl = div.closest("section");
      const scale = getSlideScale();
      const divRect = div.getBoundingClientRect();
      const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
      const origLeft = (divRect.left - slideRect.left) / scale;
      const origTop = (divRect.top - slideRect.top) / scale;
      if (div.dataset.editableModifiedFenceType === "columns") {
        setCapabilityOverride(div, ["move", "resize", "rotate"]);
        const naturalWidth = div.offsetWidth;
        const naturalHeight = div.offsetHeight;
        setupDivWhenReady(div);
        div.style.display = "flex";
        editableRegistry.get(div)?.setState({ width: naturalWidth, height: naturalHeight, x: origLeft, y: origTop });
      } else {
        setupDivWhenReady(div);
        waitForRegistryThenFixPosition(div, origLeft, origTop);
      }
    },
    serialize(text) {
      const divs = Array.from(
        document.querySelectorAll('div[data-editable-modified-fence="true"]')
      );
      if (divs.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const byChunk = /* @__PURE__ */ new Map();
      for (const div of divs) {
        if (!editableRegistry.has(div))
          continue;
        const slideIndex = parseInt(div.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!byChunk.has(chunkIndex))
          byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(div);
      }
      for (const [chunkIndex, chunkDivs] of byChunk) {
        const fencedOpens = parseFencedDivOpens(chunks[chunkIndex]);
        const ops = [];
        for (const div of chunkDivs) {
          const fenceIdx = parseInt(div.dataset.editableModifiedFenceIdx ?? "-1", 10);
          if (fenceIdx < 0)
            continue;
          const openEntry = fencedOpens[fenceIdx];
          if (!openEntry)
            continue;
          const dims = editableRegistry.get(div).toDimensions();
          const isCallout = div.dataset.editableModifiedFenceType === "callout";
          ops.push({ openEntry, dims, isCallout });
        }
        ops.sort((a, b) => b.openEntry.lineIndex - a.openEntry.lineIndex);
        const lines = chunks[chunkIndex].split("\n");
        for (const { openEntry, dims, isCallout } of ops) {
          if (isCallout && openEntry.closeLineIndex >= 0) {
            const posAttrs = [
              `left=${Math.round(dims.left)}px`,
              `top=${Math.round(dims.top)}px`,
              `width=${Math.round(dims.width)}px`
            ];
            const styleAttrs = [];
            if (dims.rotation)
              styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
            let wrapAttrs = `.absolute ${posAttrs.join(" ")}`;
            if (styleAttrs.length > 0)
              wrapAttrs += ` style="${styleAttrs.join(" ")}"`;
            lines.splice(openEntry.closeLineIndex + 1, 0, "::::");
            lines.splice(openEntry.lineIndex, 0, `:::: {${wrapAttrs}}`);
          } else {
            lines[openEntry.lineIndex] = buildFenceLineWithAbsolute(lines[openEntry.lineIndex], dims);
          }
        }
        chunks[chunkIndex] = lines.join("\n");
      }
      return chunks.join("");
    }
  });
  function extractParagraphBlocks(chunk) {
    const lines = chunk.split("\n");
    const blocks = [];
    let depth = 0;
    let inCodeBlock = false;
    let blockStart = -1;
    const blockLines = [];
    const commitBlock = () => {
      if (blockLines.length > 0) {
        const text = blockLines.join("\n");
        if (!/!\[[^\]]*\]\(/.test(text)) {
          blocks.push({
            startLine: blockStart,
            endLine: blockStart + blockLines.length - 1,
            text
          });
        }
      }
      blockStart = -1;
      blockLines.length = 0;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        commitBlock();
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock)
        continue;
      const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
      if (fenceMatch) {
        commitBlock();
        const hasBraces = fenceMatch[2] !== void 0;
        if (!hasBraces && depth > 0) {
          depth--;
        } else {
          depth++;
        }
        continue;
      }
      if (depth > 0)
        continue;
      if (trimmed.startsWith("#")) {
        commitBlock();
        continue;
      }
      if (trimmed === "") {
        commitBlock();
        continue;
      }
      if (blockStart === -1)
        blockStart = i;
      blockLines.push(line);
    }
    commitBlock();
    return blocks;
  }
  ModifyModeClassifier.register({
    label: "Paragraphs",
    classify(slideEl) {
      const candidates = Array.from(slideEl.children).filter(
        (el) => el.tagName === "P" && !editableRegistry.has(el) && !el.classList.contains("absolute") && !el.querySelector("img")
      );
      const valid = [];
      let idx = 0;
      for (const p of candidates) {
        p.dataset.editableModifiedParagraphIdx = String(idx++);
        valid.push(p);
      }
      return { valid, warn: [] };
    },
    activate(p) {
      const slideIndex = Reveal.getState().indexh;
      const slideEl = p.closest("section");
      const scale = getSlideScale();
      const pRect = p.getBoundingClientRect();
      const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
      const origLeft = (pRect.left - slideRect.left) / scale;
      const origTop = (pRect.top - slideRect.top) / scale;
      p.dataset.editableModifiedParagraph = "true";
      p.dataset.editableModifiedSlide = String(slideIndex);
      initializeQuillForElement(p);
      setupDivWhenReady(p);
      waitForRegistryThenFixPosition(p, origLeft, origTop);
    },
    serialize(text) {
      const paras = Array.from(
        document.querySelectorAll('p[data-editable-modified-paragraph="true"]')
      );
      if (paras.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const byChunk = /* @__PURE__ */ new Map();
      for (const p of paras) {
        if (!editableRegistry.has(p))
          continue;
        const slideIndex = parseInt(p.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!byChunk.has(chunkIndex))
          byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(p);
      }
      for (const [chunkIndex, chunkParas] of byChunk) {
        chunkParas.sort(
          (a, b) => parseInt(a.dataset.editableModifiedParagraphIdx ?? "0", 10) - parseInt(b.dataset.editableModifiedParagraphIdx ?? "0", 10)
        );
        const paraBlocks = extractParagraphBlocks(chunks[chunkIndex]);
        const lines = chunks[chunkIndex].split("\n");
        for (let i = chunkParas.length - 1; i >= 0; i--) {
          const p = chunkParas[i];
          const paraIdx = parseInt(p.dataset.editableModifiedParagraphIdx ?? "0", 10);
          if (paraIdx >= paraBlocks.length)
            continue;
          const block = paraBlocks[paraIdx];
          const dims = editableRegistry.get(p).toDimensions();
          const content = p.querySelector(".ql-editor") ? elementToText(p) : block.text;
          const posAttrs = [
            `left=${Math.round(dims.left)}px`,
            `top=${Math.round(dims.top)}px`,
            `width=${Math.round(dims.width)}px`,
            `height=${Math.round(dims.height)}px`
          ];
          const styleAttrs = [];
          if (dims.rotation)
            styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
          let attrs = `.absolute ${posAttrs.join(" ")}`;
          if (styleAttrs.length)
            attrs += ` style="${styleAttrs.join(" ")}"`;
          const blockLineCount = block.endLine - block.startLine + 1;
          lines.splice(
            block.startLine,
            blockLineCount,
            `::: {${attrs}}`,
            content,
            ":::"
          );
        }
        chunks[chunkIndex] = lines.join("\n");
      }
      return chunks.join("");
    }
  });
  function extractBlocksStartingWith(chunk, testLine) {
    const lines = chunk.split("\n");
    const blocks = [];
    let depth = 0;
    let inCodeBlock = false;
    let blockStart = -1;
    const blockLines = [];
    const commitBlock = () => {
      if (blockLines.length > 0) {
        blocks.push({
          startLine: blockStart,
          endLine: blockStart + blockLines.length - 1,
          text: blockLines.join("\n")
        });
      }
      blockStart = -1;
      blockLines.length = 0;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        commitBlock();
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock)
        continue;
      const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
      if (fenceMatch) {
        commitBlock();
        const hasBraces = fenceMatch[2] !== void 0;
        if (!hasBraces && depth > 0)
          depth--;
        else
          depth++;
        continue;
      }
      if (depth > 0)
        continue;
      if (trimmed === "") {
        commitBlock();
        continue;
      }
      if (blockStart === -1) {
        if (testLine(line)) {
          blockStart = i;
          blockLines.push(line);
        }
      } else {
        blockLines.push(line);
      }
    }
    commitBlock();
    return blocks;
  }
  function makeListClassifier({ tagName, dataKey, testLine, label }) {
    const idxAttr = `editableModified${dataKey}Idx`;
    const activeAttr = `editableModified${dataKey}`;
    return {
      label,
      classify(slideEl) {
        const candidates = Array.from(slideEl.children).filter(
          (el) => el.tagName === tagName && !editableRegistry.has(el) && !el.classList.contains("absolute")
        );
        const valid = [];
        let idx = 0;
        for (const el of candidates) {
          el.dataset[idxAttr] = String(idx++);
          valid.push(el);
        }
        return { valid, warn: [] };
      },
      activate(el) {
        const slideIndex = Reveal.getState().indexh;
        const slideEl = el.closest("section");
        const scale = getSlideScale();
        const elRect = el.getBoundingClientRect();
        const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
        const origLeft = (elRect.left - slideRect.left) / scale;
        const origTop = (elRect.top - slideRect.top) / scale;
        const cs = window.getComputedStyle(el);
        const naturalW = elRect.width / scale;
        const naturalH = elRect.height / scale;
        el.style.paddingLeft = cs.paddingLeft;
        el.style.paddingRight = cs.paddingRight;
        el.style.paddingTop = cs.paddingTop;
        el.style.paddingBottom = cs.paddingBottom;
        el.style.margin = "0";
        el.style.width = naturalW + "px";
        el.style.height = naturalH + "px";
        el.style.display = "block";
        el.dataset[activeAttr] = "true";
        el.dataset.editableModifiedSlide = String(slideIndex);
        setCapabilityOverride(el, ["move", "resize"]);
        setupDivWhenReady(el);
        waitForRegistryThenFixPosition(el, origLeft, origTop);
      },
      serialize(text) {
        const htmlAttr = `data-editable-modified-${dataKey.toLowerCase()}`;
        const els = Array.from(
          document.querySelectorAll(`${tagName.toLowerCase()}[${htmlAttr}="true"]`)
        );
        if (els.length === 0)
          return text;
        const chunks = splitIntoSlideChunks(text);
        const byChunk = /* @__PURE__ */ new Map();
        for (const el of els) {
          if (!editableRegistry.has(el))
            continue;
          const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? "0", 10);
          const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
          if (chunkIndex >= chunks.length)
            continue;
          if (!byChunk.has(chunkIndex))
            byChunk.set(chunkIndex, []);
          byChunk.get(chunkIndex).push(el);
        }
        for (const [chunkIndex, chunkEls] of byChunk) {
          chunkEls.sort(
            (a, b) => parseInt(a.dataset[idxAttr] ?? "0", 10) - parseInt(b.dataset[idxAttr] ?? "0", 10)
          );
          const blocks = extractBlocksStartingWith(chunks[chunkIndex], testLine);
          const lines = chunks[chunkIndex].split("\n");
          for (let i = chunkEls.length - 1; i >= 0; i--) {
            const el = chunkEls[i];
            const elIdx = parseInt(el.dataset[idxAttr] ?? "0", 10);
            if (elIdx >= blocks.length)
              continue;
            const block = blocks[elIdx];
            const dims = editableRegistry.get(el).toDimensions();
            const posAttrs = [
              `left=${Math.round(dims.left)}px`,
              `top=${Math.round(dims.top)}px`,
              `width=${Math.round(dims.width)}px`,
              `height=${Math.round(dims.height)}px`
            ];
            const styleAttrs = [];
            if (dims.rotation)
              styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
            let attrs = `.absolute ${posAttrs.join(" ")}`;
            if (styleAttrs.length)
              attrs += ` style="${styleAttrs.join(" ")}"`;
            const blockLineCount = block.endLine - block.startLine + 1;
            lines.splice(
              block.startLine,
              blockLineCount,
              `::: {${attrs}}`,
              block.text,
              ":::"
            );
          }
          chunks[chunkIndex] = lines.join("\n");
        }
        return chunks.join("");
      }
    };
  }
  ModifyModeClassifier.register(makeListClassifier({
    tagName: "UL",
    dataKey: "Ul",
    testLine: (line) => /^[-*+] /.test(line),
    label: "Bullet lists"
  }));
  ModifyModeClassifier.register(makeListClassifier({
    tagName: "OL",
    dataKey: "Ol",
    testLine: (line) => /^\d+[.)]\s/.test(line),
    label: "Ordered lists"
  }));
  ModifyModeClassifier.register(makeListClassifier({
    tagName: "BLOCKQUOTE",
    dataKey: "Blockquote",
    testLine: (line) => /^>/.test(line),
    label: "Blockquotes"
  }));
  var SUPPORTED_ARROW_KWARGS = /* @__PURE__ */ new Set([
    "from",
    "to",
    "control1",
    "control2",
    "waypoints",
    "smooth",
    "color",
    "width",
    "head",
    "dash",
    "line",
    "opacity",
    "label",
    "label-position",
    "label-offset",
    "position"
  ]);
  function parseArrowKwargs(body) {
    const kwargs = {};
    const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const value = m[2] !== void 0 ? m[2] : m[3] !== void 0 ? m[3] : m[4];
      kwargs[m[1]] = value;
    }
    return kwargs;
  }
  function parseArrowPoint(s) {
    if (!s)
      return null;
    const parts = s.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length !== 2 || parts.some(isNaN))
      return null;
    return { x: parts[0], y: parts[1] };
  }
  function parseArrowWaypoints(s) {
    if (!s)
      return [];
    return s.trim().split(/\s+/).map(parseArrowPoint).filter((p) => p !== null);
  }
  function parseArrowShortcodes(chunk) {
    const re = /\{\{<\s*arrow\s+([^>]*?)\s*>\}\}/g;
    const out = [];
    let m;
    while ((m = re.exec(chunk)) !== null) {
      out.push({
        raw: m[0],
        body: m[1],
        kwargs: parseArrowKwargs(m[1]),
        index: m.index
      });
    }
    return out;
  }
  function filterPositionedArrows(shortcodes) {
    return shortcodes.filter(
      (sc) => sc.kwargs.position === "absolute" || sc.kwargs.position === "fixed"
    );
  }
  function unsupportedArrowKwargs(kwargs) {
    return Object.keys(kwargs).filter((k) => !SUPPORTED_ARROW_KWARGS.has(k));
  }
  function arrowDataFromKwargs(kwargs) {
    const from = parseArrowPoint(kwargs.from) || { x: 0, y: 0 };
    const to = parseArrowPoint(kwargs.to) || { x: 0, y: 0 };
    const c1 = parseArrowPoint(kwargs.control1);
    const c2 = parseArrowPoint(kwargs.control2);
    const waypoints = parseArrowWaypoints(kwargs.waypoints);
    const numOr = (v, d) => {
      if (v === void 0 || v === null || v === "")
        return d;
      const n = parseFloat(v);
      return isNaN(n) ? d : n;
    };
    return {
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      control1X: c1 ? c1.x : null,
      control1Y: c1 ? c1.y : null,
      control2X: c2 ? c2.x : null,
      control2Y: c2 ? c2.y : null,
      curveMode: !!(c1 || c2),
      waypoints,
      smooth: kwargs.smooth === "true" || kwargs.smooth === true,
      color: kwargs.color || CONFIG.ARROW_DEFAULT_COLOR,
      width: numOr(kwargs.width, CONFIG.ARROW_DEFAULT_WIDTH),
      head: kwargs.head || "arrow",
      dash: kwargs.dash || "solid",
      line: kwargs.line || "single",
      opacity: numOr(kwargs.opacity, 1),
      label: kwargs.label || "",
      labelPosition: kwargs["label-position"] || CONFIG.ARROW_DEFAULT_LABEL_POSITION,
      labelOffset: numOr(kwargs["label-offset"], CONFIG.ARROW_DEFAULT_LABEL_OFFSET),
      isActive: false
    };
  }
  var _modifiedArrows = [];
  var _arrowsWithPointerEventsCleared = /* @__PURE__ */ new Set();
  function findPositionedArrowDivs(slideEl) {
    const all = slideEl.querySelectorAll('div[style*="position: absolute"]');
    const out = [];
    for (const el of all) {
      if (el.classList.contains("editable-arrow-container"))
        continue;
      if (el.dataset.editableModifiedArrow === "true")
        continue;
      if (el.dataset.editableModifiedArrowHidden === "true")
        continue;
      const svg = el.querySelector(":scope > svg");
      if (!svg)
        continue;
      if (!svg.querySelector(':scope > defs > marker[id^="arrow-"]'))
        continue;
      out.push(el);
    }
    return out;
  }
  ModifyModeClassifier.register({
    label: "Positioned arrows",
    classify(slideEl) {
      for (const path of _arrowsWithPointerEventsCleared) {
        path.style.pointerEvents = "";
      }
      _arrowsWithPointerEventsCleared.clear();
      if (!window._input_file)
        return { valid: [], warn: [] };
      const slideIndex = Reveal.getState().indexh;
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      const chunks = splitIntoSlideChunks(window._input_file);
      const chunk = chunks[chunkIndex];
      if (!chunk)
        return { valid: [], warn: [] };
      const shortcodes = parseArrowShortcodes(chunk);
      const positioned = filterPositionedArrows(shortcodes);
      if (positioned.length === 0)
        return { valid: [], warn: [] };
      const divs = findPositionedArrowDivs(slideEl);
      if (divs.length === 0)
        return { valid: [], warn: [] };
      const pairCount = Math.min(positioned.length, divs.length);
      const valid = [];
      const warn = [];
      const literalCounts = /* @__PURE__ */ new Map();
      for (let i = 0; i < pairCount; i++) {
        const sc = positioned[i];
        const div = divs[i];
        const unsupported = unsupportedArrowKwargs(sc.kwargs);
        if (unsupported.length > 0) {
          warn.push({
            el: div,
            reason: `Arrow uses attributes not yet supported in modify mode: ${unsupported.join(", ")}`
          });
          continue;
        }
        const occurrence = literalCounts.get(sc.raw) ?? 0;
        literalCounts.set(sc.raw, occurrence + 1);
        div.dataset.editableModifiedArrowSource = sc.raw;
        div.dataset.editableModifiedArrowOccurrence = String(occurrence);
        div.dataset.editableModifiedArrowKwargs = JSON.stringify(sc.kwargs);
        div.querySelectorAll("svg path").forEach((p) => {
          p.style.pointerEvents = "auto";
          _arrowsWithPointerEventsCleared.add(p);
        });
        valid.push(div);
      }
      return { valid, warn };
    },
    activate(div) {
      const slideEl = div.closest("section");
      if (!slideEl)
        return;
      const kwargsJson = div.dataset.editableModifiedArrowKwargs;
      if (!kwargsJson)
        return;
      let kwargs;
      try {
        kwargs = JSON.parse(kwargsJson);
      } catch (e) {
        return;
      }
      const slideIndex = Reveal.getState().indexh;
      const arrowData = arrowDataFromKwargs(kwargs);
      arrowData.isActive = true;
      div.dataset.editableModifiedArrowHidden = "true";
      div.style.display = "none";
      exitModifyMode({ resetPanel: false });
      const arrowContainer = createArrowElement(arrowData);
      slideEl.appendChild(arrowContainer);
      arrowData.element = arrowContainer;
      arrowContainer.classList.remove("editable-new");
      _modifiedArrows.push({
        arrowData,
        sourceEl: div,
        slideIndex,
        sourceLiteral: div.dataset.editableModifiedArrowSource,
        occurrence: parseInt(div.dataset.editableModifiedArrowOccurrence ?? "0", 10)
      });
      setActiveArrow(arrowData);
      return true;
    },
    serialize(text) {
      if (_modifiedArrows.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const byChunk = /* @__PURE__ */ new Map();
      for (const entry of _modifiedArrows) {
        const chunkIndex = getQmdHeadingIndex(entry.slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!byChunk.has(chunkIndex))
          byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(entry);
      }
      for (const [chunkIndex, entries] of byChunk) {
        entries.sort((a, b) => {
          if (a.sourceLiteral.length !== b.sourceLiteral.length) {
            return b.sourceLiteral.length - a.sourceLiteral.length;
          }
          return a.occurrence - b.occurrence;
        });
        const consumed = /* @__PURE__ */ new Map();
        for (const entry of entries) {
          const replacement = serializeArrowToShortcode(entry.arrowData);
          const literal = entry.sourceLiteral;
          const skipCount = consumed.get(literal) ?? 0;
          let chunk = chunks[chunkIndex];
          let searchFrom = 0;
          let hit = -1;
          for (let i = 0; i <= skipCount; i++) {
            hit = chunk.indexOf(literal, searchFrom);
            if (hit === -1)
              break;
            searchFrom = hit + literal.length;
          }
          if (hit === -1)
            continue;
          chunks[chunkIndex] = chunk.slice(0, hit) + replacement + chunk.slice(hit + literal.length);
          consumed.set(literal, skipCount + 1);
        }
      }
      return chunks.join("");
    },
    cleanup() {
      for (const path of _arrowsWithPointerEventsCleared) {
        path.style.pointerEvents = "";
      }
      _arrowsWithPointerEventsCleared.clear();
    }
  });
  function extractCodeBlocks(chunk) {
    const lines = chunk.split("\n");
    const blocks = [];
    let depth = 0;
    let blockStart = -1;
    let inBlock = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inBlock) {
        const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
        if (fenceMatch) {
          const hasBraces = fenceMatch[2] !== void 0;
          if (!hasBraces && depth > 0)
            depth--;
          else
            depth++;
          continue;
        }
        if (depth === 0 && /^```/.test(line)) {
          inBlock = true;
          blockStart = i;
        }
      } else {
        if (/^```\s*$/.test(line)) {
          const firstCodeLine = lines.slice(blockStart + 1, i).find((l) => l.trim() !== "") ?? "";
          blocks.push({ startLine: blockStart, endLine: i, firstCodeLine });
          inBlock = false;
          blockStart = -1;
        }
      }
    }
    return blocks;
  }
  function topLevelAncestorIn(slideEl, el) {
    let node = el;
    while (node && node.parentElement && node.parentElement !== slideEl) {
      node = node.parentElement;
    }
    return node && node.parentElement === slideEl ? node : null;
  }
  function getCodeFirstLine(wrapper) {
    const code = wrapper.querySelector("pre code") ?? wrapper.querySelector("pre") ?? wrapper;
    const text = code.textContent || "";
    return text.split("\n").find((l) => l.trim() !== "") ?? "";
  }
  ModifyModeClassifier.register({
    label: "Code blocks",
    classify(slideEl) {
      const pres = Array.from(slideEl.querySelectorAll("pre"));
      if (pres.length === 0)
        return { valid: [], warn: [] };
      const seen = /* @__PURE__ */ new Set();
      const valid = [];
      let idx = 0;
      for (const pre of pres) {
        const wrapper = topLevelAncestorIn(slideEl, pre);
        if (!wrapper)
          continue;
        if (seen.has(wrapper))
          continue;
        seen.add(wrapper);
        if (editableRegistry.has(wrapper))
          continue;
        if (wrapper.classList.contains("editable-container"))
          continue;
        if (wrapper.classList.contains("absolute"))
          continue;
        if (wrapper.closest("div.absolute"))
          continue;
        if (wrapper.tagName === "DIV" && wrapper.classList.contains("cell"))
          continue;
        wrapper.dataset.editableModifiedCodeIdx = String(idx++);
        wrapper.dataset.editableModifiedCodeFirstLine = getCodeFirstLine(wrapper);
        valid.push(wrapper);
      }
      return { valid, warn: [] };
    },
    activate(el) {
      const slideIndex = Reveal.getState().indexh;
      const slideEl = el.closest("section");
      const scale = getSlideScale();
      const elRect = el.getBoundingClientRect();
      const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
      const origLeft = (elRect.left - slideRect.left) / scale;
      const origTop = (elRect.top - slideRect.top) / scale;
      const cs = window.getComputedStyle(el);
      const naturalW = elRect.width / scale;
      const naturalH = elRect.height / scale;
      el.style.paddingLeft = cs.paddingLeft;
      el.style.paddingRight = cs.paddingRight;
      el.style.paddingTop = cs.paddingTop;
      el.style.paddingBottom = cs.paddingBottom;
      el.style.margin = "0";
      el.style.width = naturalW + "px";
      el.style.height = naturalH + "px";
      el.style.display = "block";
      el.dataset.editableModifiedCode = "true";
      el.dataset.editableModifiedSlide = String(slideIndex);
      setCapabilityOverride(el, ["move", "resize"]);
      setupDraggableElt(el);
      waitForRegistryThenFixPosition(el, origLeft, origTop);
    },
    serialize(text) {
      const els = Array.from(
        document.querySelectorAll('[data-editable-modified-code="true"]')
      );
      if (els.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const byChunk = /* @__PURE__ */ new Map();
      for (const el of els) {
        if (!editableRegistry.has(el))
          continue;
        const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!byChunk.has(chunkIndex))
          byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(el);
      }
      for (const [chunkIndex, chunkEls] of byChunk) {
        chunkEls.sort(
          (a, b) => parseInt(a.dataset.editableModifiedCodeIdx ?? "0", 10) - parseInt(b.dataset.editableModifiedCodeIdx ?? "0", 10)
        );
        const blocks = extractCodeBlocks(chunks[chunkIndex]);
        const lines = chunks[chunkIndex].split("\n");
        for (let i = chunkEls.length - 1; i >= 0; i--) {
          const el = chunkEls[i];
          const codeIdx = parseInt(el.dataset.editableModifiedCodeIdx ?? "0", 10);
          if (codeIdx >= blocks.length)
            continue;
          const expectedFirst = (el.dataset.editableModifiedCodeFirstLine ?? "").trim();
          const actualFirst = (blocks[codeIdx].firstCodeLine ?? "").trim();
          if (expectedFirst && actualFirst && expectedFirst !== actualFirst)
            continue;
          const block = blocks[codeIdx];
          const dims = editableRegistry.get(el).toDimensions();
          const posAttrs = [
            `left=${Math.round(dims.left)}px`,
            `top=${Math.round(dims.top)}px`,
            `width=${Math.round(dims.width)}px`,
            `height=${Math.round(dims.height)}px`
          ];
          const styleAttrs = [];
          if (dims.rotation)
            styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
          let attrs = `.absolute ${posAttrs.join(" ")}`;
          if (styleAttrs.length)
            attrs += ` style="${styleAttrs.join(" ")}"`;
          lines.splice(block.endLine + 1, 0, ":::");
          lines.splice(block.startLine, 0, `::: {${attrs}}`);
        }
        chunks[chunkIndex] = lines.join("\n");
      }
      return chunks.join("");
    }
  });
  function extractExecutableChunks(chunk) {
    const lines = chunk.split("\n");
    const chunks = [];
    let depth = 0;
    let chunkStart = -1;
    let chunkLabel = null;
    let inChunk = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inChunk) {
        const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
        if (fenceMatch) {
          const hasBraces = fenceMatch[2] !== void 0;
          if (!hasBraces && depth > 0)
            depth--;
          else
            depth++;
          continue;
        }
        if (depth === 0) {
          const execMatch = line.match(/^```+\s*\{([^}]+)\}\s*$/);
          if (execMatch) {
            const inner = execMatch[1].trim();
            const tokens = inner.split(/\s+/);
            let label = null;
            if (tokens.length >= 2 && !tokens[1].includes("=") && !tokens[1].startsWith(".")) {
              label = tokens[1];
            }
            inChunk = true;
            chunkStart = i;
            chunkLabel = label;
          }
        }
      } else {
        if (/^```\s*$/.test(line)) {
          const body = lines.slice(chunkStart + 1, i);
          const firstCodeLine = body.find((l) => l.trim() !== "" && !l.trim().startsWith("#|")) ?? "";
          if (chunkLabel === null) {
            for (const l of body) {
              const m = l.match(/^\s*#\|\s*label:\s*([A-Za-z0-9_-]+)\s*$/);
              if (m) {
                chunkLabel = m[1];
                break;
              }
              if (l.trim() !== "" && !l.trim().startsWith("#|"))
                break;
            }
          }
          chunks.push({ startLine: chunkStart, endLine: i, label: chunkLabel, firstCodeLine });
          inChunk = false;
          chunkStart = -1;
          chunkLabel = null;
        }
      }
    }
    return chunks;
  }
  function cellQualifiesForOutput(cell) {
    const outputs = cell.querySelectorAll('[class*="cell-output"]');
    if (outputs.length === 0)
      return false;
    if (cell.querySelector("img"))
      return false;
    for (const out of outputs) {
      if (out.children.length > 0 || out.textContent.trim() !== "")
        return true;
    }
    return false;
  }
  ModifyModeClassifier.register({
    label: "Code chunk outputs",
    classify(slideEl) {
      if (!window._input_file)
        return { valid: [], warn: [] };
      const slideIndex = Reveal.getState().indexh;
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      const chunks = splitIntoSlideChunks(window._input_file);
      const chunk = chunks[chunkIndex];
      if (!chunk)
        return { valid: [], warn: [] };
      const execChunks = extractExecutableChunks(chunk);
      if (execChunks.length === 0)
        return { valid: [], warn: [] };
      const allCells = [];
      for (const child of slideEl.children) {
        if (child.tagName !== "DIV")
          continue;
        if (child.classList.contains("cell")) {
          if (child.classList.contains("absolute"))
            continue;
          if (child.closest("div.absolute"))
            continue;
          allCells.push(child);
        } else if (child.classList.contains("editable-container")) {
          const inner = child.querySelector(":scope > div.cell");
          if (inner)
            allCells.push(inner);
        }
      }
      if (allCells.length !== execChunks.length)
        return { valid: [], warn: [] };
      const valid = [];
      for (let i = 0; i < allCells.length; i++) {
        const cell = allCells[i];
        if (editableRegistry.has(cell))
          continue;
        if (cell.closest(".editable-container"))
          continue;
        if (!cellQualifiesForOutput(cell))
          continue;
        const exec = execChunks[i];
        cell.dataset.editableModifiedCellIdx = String(i);
        cell.dataset.editableModifiedCellLabel = exec.label || "";
        cell.dataset.editableModifiedCellFirstLine = exec.firstCodeLine;
        valid.push(cell);
      }
      return { valid, warn: [] };
    },
    activate(el) {
      const slideIndex = Reveal.getState().indexh;
      const slideEl = el.closest("section");
      const scale = getSlideScale();
      const elRect = el.getBoundingClientRect();
      const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
      const origLeft = (elRect.left - slideRect.left) / scale;
      const origTop = (elRect.top - slideRect.top) / scale;
      const cs = window.getComputedStyle(el);
      const naturalW = elRect.width / scale;
      const naturalH = elRect.height / scale;
      el.style.paddingLeft = cs.paddingLeft;
      el.style.paddingRight = cs.paddingRight;
      el.style.paddingTop = cs.paddingTop;
      el.style.paddingBottom = cs.paddingBottom;
      el.style.margin = "0";
      el.style.width = naturalW + "px";
      el.style.height = naturalH + "px";
      el.style.display = "block";
      el.dataset.editableModifiedCell = "true";
      el.dataset.editableModifiedSlide = String(slideIndex);
      setCapabilityOverride(el, ["move", "resize"]);
      setupDraggableElt(el);
      waitForRegistryThenFixPosition(el, origLeft, origTop);
    },
    serialize(text) {
      const els = Array.from(
        document.querySelectorAll('[data-editable-modified-cell="true"]')
      );
      if (els.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const byChunk = /* @__PURE__ */ new Map();
      for (const el of els) {
        if (!editableRegistry.has(el))
          continue;
        const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!byChunk.has(chunkIndex))
          byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(el);
      }
      for (const [chunkIndex, chunkEls] of byChunk) {
        chunkEls.sort(
          (a, b) => parseInt(a.dataset.editableModifiedCellIdx ?? "0", 10) - parseInt(b.dataset.editableModifiedCellIdx ?? "0", 10)
        );
        const execChunks = extractExecutableChunks(chunks[chunkIndex]);
        const lines = chunks[chunkIndex].split("\n");
        for (let i = chunkEls.length - 1; i >= 0; i--) {
          const el = chunkEls[i];
          const cellLabel = el.dataset.editableModifiedCellLabel || "";
          const cellFirstLine = (el.dataset.editableModifiedCellFirstLine ?? "").trim();
          const cellIdx = parseInt(el.dataset.editableModifiedCellIdx ?? "-1", 10);
          let target = null;
          if (cellLabel) {
            target = execChunks.find((c) => c.label === cellLabel) ?? null;
          }
          if (!target && cellIdx >= 0 && cellIdx < execChunks.length) {
            const candidate = execChunks[cellIdx];
            const actualFirst = (candidate.firstCodeLine ?? "").trim();
            if (!cellFirstLine || !actualFirst || cellFirstLine === actualFirst) {
              target = candidate;
            }
          }
          if (!target)
            continue;
          const dims = editableRegistry.get(el).toDimensions();
          const posAttrs = [
            `left=${Math.round(dims.left)}px`,
            `top=${Math.round(dims.top)}px`,
            `width=${Math.round(dims.width)}px`,
            `height=${Math.round(dims.height)}px`
          ];
          const styleAttrs = [];
          if (dims.rotation)
            styleAttrs.push(`transform: rotate(${Math.round(dims.rotation)}deg);`);
          let attrs = `.absolute ${posAttrs.join(" ")}`;
          if (styleAttrs.length)
            attrs += ` style="${styleAttrs.join(" ")}"`;
          lines.splice(target.endLine + 1, 0, ":::");
          lines.splice(target.startLine, 0, `::: {${attrs}}`);
        }
        chunks[chunkIndex] = lines.join("\n");
      }
      return chunks.join("");
    }
  });
  function extractTables(chunk) {
    const lines = chunk.split("\n");
    const tables = [];
    let depth = 0;
    let inCode = false;
    const isPipeRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isPipeSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(l);
    const isGridBorder = (l) => /^\s*\+[-=+:]{3,}\+\s*$/.test(l);
    const isGridRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isHtmlOpen = (l) => /^\s*<table[\s>]/i.test(l);
    const isHtmlClose = (l) => /<\/table\s*>/i.test(l);
    const isCaption = (l) => /^\s*(:|Table:)\s+\S/.test(l);
    function extendWithCaption(end) {
      let j = end + 1;
      while (j < lines.length && lines[j].trim() === "")
        j++;
      if (j < lines.length && isCaption(lines[j])) {
        let capEnd = j;
        while (capEnd + 1 < lines.length && lines[capEnd + 1].trim() !== "")
          capEnd++;
        return capEnd;
      }
      return end;
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (inCode) {
        if (/^```\s*$/.test(line))
          inCode = false;
        continue;
      }
      if (/^```/.test(line)) {
        inCode = true;
        continue;
      }
      const fenceMatch = line.match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
      if (fenceMatch) {
        const hasBraces = fenceMatch[2] !== void 0;
        if (hasBraces && depth === 0 && /(^|[\s\{])\.list-table(\s|\})/.test(fenceMatch[2])) {
          const start = i;
          let inner = 1;
          let end = -1;
          let firstContent = null;
          for (let j = i + 1; j < lines.length; j++) {
            const m2 = lines[j].match(/^(:{3,})\s*(\{[^}]*\})?\s*$/);
            if (m2) {
              if (m2[2] !== void 0)
                inner++;
              else
                inner--;
              if (inner === 0) {
                end = j;
                break;
              }
            } else if (firstContent === null && lines[j].trim()) {
              firstContent = lines[j];
            }
          }
          if (end !== -1) {
            const extended = extendWithCaption(end);
            tables.push({
              startLine: start,
              endLine: extended,
              headerLine: firstContent ?? line,
              kind: "list"
            });
            i = extended;
            continue;
          }
        }
        if (!hasBraces && depth > 0)
          depth--;
        else
          depth++;
        continue;
      }
      if (depth !== 0)
        continue;
      if (isPipeRow(line) && i + 1 < lines.length && isPipeSep(lines[i + 1])) {
        const start = i;
        let end = i + 1;
        for (let j = i + 2; j < lines.length; j++) {
          if (isPipeRow(lines[j]))
            end = j;
          else
            break;
        }
        end = extendWithCaption(end);
        tables.push({ startLine: start, endLine: end, headerLine: line, kind: "pipe" });
        i = end;
        continue;
      }
      if (isGridBorder(line)) {
        const start = i;
        let end = i;
        let firstContent = null;
        let j = i + 1;
        while (j < lines.length && (isGridBorder(lines[j]) || isGridRow(lines[j]))) {
          if (firstContent === null && isGridRow(lines[j]))
            firstContent = lines[j];
          end = j;
          j++;
        }
        if (firstContent === null || end === start)
          continue;
        end = extendWithCaption(end);
        tables.push({ startLine: start, endLine: end, headerLine: firstContent, kind: "grid" });
        i = end;
        continue;
      }
      if (isHtmlOpen(line)) {
        const start = i;
        let end = -1;
        if (isHtmlClose(line)) {
          end = i;
        } else {
          for (let j = i + 1; j < lines.length; j++) {
            if (isHtmlClose(lines[j])) {
              end = j;
              break;
            }
          }
        }
        if (end === -1)
          continue;
        end = extendWithCaption(end);
        tables.push({ startLine: start, endLine: end, headerLine: line, kind: "html" });
        i = end;
      }
    }
    return tables;
  }
  ModifyModeClassifier.register({
    label: "Tables",
    classify(slideEl) {
      if (!window._input_file)
        return { valid: [], warn: [] };
      const slideIndex = Reveal.getState().indexh;
      const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
      const chunks = splitIntoSlideChunks(window._input_file);
      const chunk = chunks[chunkIndex];
      if (!chunk)
        return { valid: [], warn: [] };
      const sourceTables = extractTables(chunk);
      if (sourceTables.length === 0)
        return { valid: [], warn: [] };
      const tables = Array.from(slideEl.querySelectorAll("table"));
      const wrappers = [];
      const seen = /* @__PURE__ */ new Set();
      for (const t of tables) {
        if (t.closest("div.cell"))
          continue;
        const w = topLevelAncestorIn(slideEl, t);
        if (!w)
          continue;
        if (seen.has(w))
          continue;
        seen.add(w);
        if (editableRegistry.has(w))
          continue;
        if (w.classList.contains("editable-container"))
          continue;
        if (w.classList.contains("absolute"))
          continue;
        if (w.closest("div.absolute"))
          continue;
        wrappers.push(w);
      }
      if (wrappers.length !== sourceTables.length)
        return { valid: [], warn: [] };
      const valid = [];
      for (let i = 0; i < wrappers.length; i++) {
        const w = wrappers[i];
        w.dataset.editableModifiedTableIdx = String(i);
        w.dataset.editableModifiedTableHeader = sourceTables[i].headerLine;
        valid.push(w);
      }
      return { valid, warn: [] };
    },
    activate(el) {
      const slideIndex = Reveal.getState().indexh;
      const slideEl = el.closest("section");
      const scale = getSlideScale();
      const elRect = el.getBoundingClientRect();
      const slideRect = slideEl ? slideEl.getBoundingClientRect() : { left: 0, top: 0 };
      const origLeft = (elRect.left - slideRect.left) / scale;
      const origTop = (elRect.top - slideRect.top) / scale;
      const cs = window.getComputedStyle(el);
      const naturalW = elRect.width / scale;
      const naturalH = elRect.height / scale;
      const isTable = el.tagName === "TABLE";
      el.style.paddingLeft = cs.paddingLeft;
      el.style.paddingRight = cs.paddingRight;
      el.style.paddingTop = cs.paddingTop;
      el.style.paddingBottom = cs.paddingBottom;
      el.style.margin = "0";
      el.style.width = naturalW + "px";
      el.style.height = naturalH + "px";
      el.dataset.editableModifiedTable = "true";
      el.dataset.editableModifiedSlide = String(slideIndex);
      setCapabilityOverride(el, ["move"]);
      setupDraggableElt(el);
      if (isTable)
        el.style.display = "table";
      waitForRegistryThenFixPosition(el, origLeft, origTop);
    },
    serialize(text) {
      const els = Array.from(
        document.querySelectorAll('[data-editable-modified-table="true"]')
      );
      if (els.length === 0)
        return text;
      const chunks = splitIntoSlideChunks(text);
      const byChunk = /* @__PURE__ */ new Map();
      for (const el of els) {
        if (!editableRegistry.has(el))
          continue;
        const slideIndex = parseInt(el.dataset.editableModifiedSlide ?? "0", 10);
        const chunkIndex = getQmdHeadingIndex(slideIndex) + 1;
        if (chunkIndex >= chunks.length)
          continue;
        if (!byChunk.has(chunkIndex))
          byChunk.set(chunkIndex, []);
        byChunk.get(chunkIndex).push(el);
      }
      for (const [chunkIndex, chunkEls] of byChunk) {
        chunkEls.sort(
          (a, b) => parseInt(a.dataset.editableModifiedTableIdx ?? "0", 10) - parseInt(b.dataset.editableModifiedTableIdx ?? "0", 10)
        );
        const sourceTables = extractTables(chunks[chunkIndex]);
        const lines = chunks[chunkIndex].split("\n");
        const headerCounts = /* @__PURE__ */ new Map();
        for (const t of sourceTables) {
          const h = (t.headerLine ?? "").trim();
          headerCounts.set(h, (headerCounts.get(h) ?? 0) + 1);
        }
        const resolved = chunkEls.map((el) => {
          const tableIdx = parseInt(el.dataset.editableModifiedTableIdx ?? "-1", 10);
          const expectedHeader = (el.dataset.editableModifiedTableHeader ?? "").trim();
          if (expectedHeader && headerCounts.get(expectedHeader) === 1) {
            return sourceTables.find((t) => (t.headerLine ?? "").trim() === expectedHeader) ?? null;
          }
          if (tableIdx >= 0 && tableIdx < sourceTables.length)
            return sourceTables[tableIdx];
          return null;
        });
        const plan = chunkEls.map((el, i) => ({ el, target: resolved[i] })).filter((p) => p.target).sort((a, b) => b.target.startLine - a.target.startLine);
        for (const { el, target } of plan) {
          const dims = editableRegistry.get(el).toDimensions();
          const attrs = `.absolute left=${Math.round(dims.left)}px top=${Math.round(dims.top)}px`;
          lines.splice(target.endLine + 1, 0, ":::");
          lines.splice(target.startLine, 0, `::: {${attrs}}`);
        }
        chunks[chunkIndex] = lines.join("\n");
      }
      return chunks.join("");
    }
  });
  function classifyElements() {
    const reveal = document.querySelector(".reveal");
    const currentSlide = reveal?.querySelector(".slides section.present:not(.slide-background)") ?? reveal;
    const valid = [];
    const warn = [];
    for (const classifier of _classifiers) {
      const result = classifier.classify(currentSlide);
      result.valid.forEach((el) => valid.push({ el, classifier }));
      result.warn.forEach(({ el, reason }) => {
        warn.push(el);
        _warnReasons.set(el, reason);
      });
    }
    return { valid, warn };
  }
  function applyClassification() {
    document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach((el) => {
      el.classList.remove(VALID_CLASS, WARN_CLASS);
    });
    abortController?.abort();
    abortController = new AbortController();
    const { signal } = abortController;
    const { valid, warn } = classifyElements();
    valid.forEach(({ el, classifier }) => {
      el.classList.add(VALID_CLASS);
      el.addEventListener("click", (e) => onValidElementClick(e, classifier), { signal });
    });
    warn.forEach((el) => el.classList.add(WARN_CLASS));
  }
  function buildModifyPanel() {
    const panel = document.querySelector(".toolbar-panel-modify");
    if (!panel)
      return;
    panel.innerHTML = "";
  }
  function enterModifyMode() {
    _active = true;
    document.querySelector(".reveal")?.classList.add(ROOT_CLASS);
    buildModifyPanel();
    showRightPanel("modify");
    applyClassification();
    Reveal.on("slidechanged", applyClassification);
  }
  function exitModifyMode({ resetPanel = true } = {}) {
    _active = false;
    document.querySelector(".reveal")?.classList.remove(ROOT_CLASS);
    Reveal.off("slidechanged", applyClassification);
    abortController?.abort();
    abortController = null;
    for (const classifier of _classifiers) {
      if (typeof classifier.cleanup === "function")
        classifier.cleanup();
    }
    document.querySelectorAll(`.${VALID_CLASS}, .${WARN_CLASS}`).forEach((el) => {
      el.classList.remove(VALID_CLASS, WARN_CLASS);
    });
    document.querySelector(".toolbar-modify")?.classList.remove("active");
    if (resetPanel)
      showRightPanel("default");
  }
  function toggleModifyMode() {
    if (_active) {
      exitModifyMode();
    } else {
      enterModifyMode();
      document.querySelector(".toolbar-modify")?.classList.add("active");
    }
  }
  function onValidElementClick(e, classifier) {
    e.stopPropagation();
    const el = e.currentTarget;
    const stayActive = classifier.activate(el);
    if (!stayActive)
      exitModifyMode();
  }

  // src/io.js
  function readIndexQmd() {
    if (!window._input_file) {
      console.error("_input_file not found. Was the editable filter applied?");
      return "";
    }
    return window._input_file;
  }
  function getEditableFilename() {
    if (!window._input_filename)
      return "untitled.qmd";
    return window._input_filename.split(/[/\\]/).pop();
  }
  function getTransformedQmd() {
    let content = readIndexQmd();
    if (!content)
      return "";
    const { text: contentWithSlides, slideLinePositions } = insertNewSlides(content);
    content = contentWithSlides;
    content = insertNewDivs(content);
    content = insertNewArrows(content);
    const dimensions = extractEditableEltDimensions();
    content = updateTextDivs(content);
    const attributes = formatEditableEltStrings(dimensions);
    const srcReplacements = dimensions.map((d) => d.src || null);
    content = replaceEditableOccurrences(content, attributes, srcReplacements);
    content = applyModifiedSerializers(content, ModifyModeClassifier);
    return content;
  }
  async function downloadString(content, mimeType = "text/plain") {
    const filename = getEditableFilename();
    if ("showSaveFilePicker" in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "Text files", accept: { [mimeType]: [".txt", ".qmd", ".md"] } }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        debug("File saved successfully");
        return;
      } catch (error) {
        debug("File picker cancelled or failed, using fallback method");
      }
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function saveMovedElts() {
    try {
      const content = getTransformedQmd();
      if (content)
        downloadString(content);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving: " + error.message);
    }
  }
  function copyQmdToClipboard() {
    const content = getTransformedQmd();
    if (!content)
      return;
    navigator.clipboard.writeText(content).then(() => {
      debug("qmd content copied to clipboard");
    }).catch((err) => {
      console.error("Failed to copy to clipboard:", err);
    });
  }

  // src/menu.js
  function addSaveMenuButton() {
    const slideMenuItems = document.querySelector(
      "div.slide-menu-custom-panel ul.slide-menu-items"
    );
    if (!slideMenuItems)
      return;
    const existingItems = slideMenuItems.querySelectorAll("li[data-item]");
    let maxDataItem = 0;
    existingItems.forEach((item) => {
      const v = parseInt(item.getAttribute("data-item")) || 0;
      if (v > maxDataItem)
        maxDataItem = v;
    });
    function addMenuHoverBehavior(li) {
      li.addEventListener("mouseenter", () => {
        slideMenuItems.querySelectorAll(".slide-tool-item.selected").forEach((el) => {
          el.classList.remove("selected");
        });
        li.classList.add("selected");
      });
      li.addEventListener("mouseleave", () => li.classList.remove("selected"));
    }
    function makeMenuItem(dataItem, kbdText, label, onClick) {
      const li = document.createElement("li");
      li.className = "slide-tool-item";
      li.setAttribute("data-item", dataItem.toString());
      const a = document.createElement("a");
      a.href = "#";
      const kbd = document.createElement("kbd");
      kbd.textContent = kbdText;
      a.appendChild(kbd);
      a.appendChild(document.createTextNode(" " + label));
      a.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      li.appendChild(a);
      addMenuHoverBehavior(li);
      return li;
    }
    slideMenuItems.appendChild(makeMenuItem(maxDataItem + 1, "?", "Save Edits", saveMovedElts));
    slideMenuItems.appendChild(makeMenuItem(maxDataItem + 2, "c", "Copy qmd to Clipboard", copyQmdToClipboard));
  }

  // src/main.js
  ToolbarRegistry.register("save", {
    icon: "\u{1F4BE}",
    label: "Save",
    title: "Save edits to file",
    className: "toolbar-save",
    zone: "left",
    onClick: () => saveMovedElts()
  });
  ToolbarRegistry.register("copy", {
    icon: "\u{1F4CB}",
    label: "Copy",
    title: "Copy QMD to clipboard",
    className: "toolbar-copy",
    zone: "left",
    onClick: () => copyQmdToClipboard()
  });
  ToolbarRegistry.register("add", {
    icon: "\u2795",
    label: "Add",
    title: "Add new elements",
    className: "toolbar-add",
    zone: "left",
    stacked: false,
    hideOnContext: true,
    submenu: [
      { icon: "\u{1F4DD}", label: "Text", title: "Add editable text to current slide", className: "toolbar-add-text", onClick: () => addNewTextElement() },
      { icon: "\u{1F5BC}\uFE0F", label: "Slide", title: "Add new slide after current", className: "toolbar-add-slide", onClick: () => addNewSlide() },
      { icon: "\u27A1\uFE0F", label: "Arrow", title: "Add arrow to current slide", className: "toolbar-add-arrow", onClick: () => addNewArrow() }
    ]
  });
  ToolbarRegistry.register("modify", {
    icon: "\u270F\uFE0F",
    label: "Modify",
    title: "Click an image to make it editable",
    className: "toolbar-modify",
    zone: "left",
    stacked: false,
    onClick: () => toggleModifyMode()
  });
  window.Revealeditable = function() {
    return {
      id: "Revealeditable",
      init: function(deck) {
        deck.on("ready", async function() {
          initArrows();
          const editableElements = getEditableElements();
          const editableDivs = Array.from(editableElements).filter(
            (el) => el.tagName.toLowerCase() === "div"
          );
          editableDivs.forEach(initializeQuillForElement);
          editableElements.forEach((elt) => {
            const tagName = elt.tagName.toLowerCase();
            if (tagName === "img")
              setupImageWhenReady(elt);
            else if (tagName === "div")
              setupDivWhenReady(elt);
          });
          addSaveMenuButton();
          createFloatingToolbar();
          setupUndoRedoKeyboard();
          document.addEventListener("click", (e) => {
            if (!e.target.closest(".editable-container:has(img)") && !e.target.closest(".editable-toolbar") && !e.target.closest(".editable-container:has(.ql-editor[contenteditable='true'])") && !e.target.closest(".editable-arrow-container")) {
              setActiveImage(null);
            }
          });
        });
      }
    };
  };
  window.editable = {
    getTransformedQmd,
    quillInstances,
    editableRegistry,
    ToolbarRegistry,
    NewElementRegistry,
    extractEditableEltDimensions,
    formatEditableEltStrings,
    replaceEditableOccurrences,
    updateTextDivs,
    serializeToQmd,
    copyQmdToClipboard,
    canUndo,
    canRedo,
    pushUndoState,
    undo,
    redo,
    getEditableElements,
    getOriginalEditableElements,
    hasTitleSlide,
    htmlToQuarto,
    readIndexQmd,
    addNewSlide,
    addNewTextElement,
    setActiveImage,
    ModifyModeClassifier
  };
  Object.assign(window, window.editable);
})();
/*! Bundled license information:

lodash-es/lodash.js:
  (**
   * @license
   * Lodash (Custom Build) <https://lodash.com/>
   * Build: `lodash modularize exports="es" --repo lodash/lodash#4.18.1 -o ./`
   * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   *)
*/
