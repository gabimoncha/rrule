import RRule from './rrule'
import dateutil from './dateutil'
import { includes } from './helpers'
import IterResult from './iterresult'

export default class RRuleSet extends RRule {
  public readonly _rrule: RRule[]
  public readonly _rdate: Date[]
  public readonly _exrule: RRule[]
  public readonly _exdate: Date[]

  /**
   *
   * @param {Boolean?} noCache
   *  The same stratagy as RRule on cache, default to false
   * @constructor
   */
  constructor (noCache: boolean = false) {
    super({}, noCache)

    this._rrule = []
    this._rdate = []
    this._exrule = []
    this._exdate = []
  }

  tzid () {
    for (let i = 0; i < this._rrule.length; i++) {
      const tzid = this._rrule[i].origOptions.tzid
      if (tzid) {
        return tzid
      }
    }
    return undefined
  }

  /**
   * Adds an RRule to the set
   *
   * @param {RRule}
   */
  rrule (rrule: RRule | string) {
    if (!(rrule instanceof RRule)) {
      throw new TypeError(String(rrule) + ' is not RRule instance')
    }
    if (!includes(this._rrule.map(String), String(rrule))) {
      this._rrule.push(rrule)
    }
  }

  /**
   * Adds an RDate to the set
   *
   * @param {Date}
   */
  rdate (date: Date) {
    if (!(date instanceof Date)) {
      throw new TypeError(String(date) + ' is not Date instance')
    }
    if (!includes(this._rdate.map(Number), Number(date))) {
      this._rdate.push(date)
      dateutil.sort(this._rdate)
    }
  }

  /**
   * Adds an EXRULE to the set
   *
   * @param {RRule}
   */
  exrule (rrule: RRule) {
    if (!(rrule instanceof RRule)) {
      throw new TypeError(String(rrule) + ' is not RRule instance')
    }
    if (!includes(this._exrule.map(String), String(rrule))) {
      this._exrule.push(rrule)
    }
  }

  /**
   * Adds an EXDATE to the set
   *
   * @param {Date}
   */
  exdate (date: Date) {
    if (!(date instanceof Date)) {
      throw new TypeError(String(date) + ' is not Date instance')
    }
    if (!includes(this._exdate.map(Number), Number(date))) {
      this._exdate.push(date)
      dateutil.sort(this._exdate)
    }
  }

  private header (param: string) {
    const tzid = this.tzid()
    if (tzid) {
      return `${param};TZID=${tzid}:`
    }

    return `${param}:`
  }

  valueOf () {
    const result: string[] = []
    if (this._rrule.length) {
      this._rrule.forEach(function (rrule) {
        rrule.toString().split('\n').map(str => result.push(str))
      })
    }
    if (this._rdate.length) {
      result.push(
        this.header('RDATE') +
          this._rdate
            .map(rdate => dateutil.timeToUntilString(rdate.valueOf(), !this.tzid()))
            .join(',')
      )
    }
    if (this._exrule.length) {
      this._exrule.forEach(function (exrule) {
        result.push('EXRULE:' + exrule)
      })
    }
    if (this._exdate.length) {
      result.push(
        this.header('EXDATE') +
          this._exdate
            .map(exdate => dateutil.timeToUntilString(exdate.valueOf(), !this.tzid()))
            .join(',')
      )
    }
    return result
  }

  /**
   * to generate recurrence field such as:
   *   ["RRULE:FREQ=YEARLY;COUNT=2;BYDAY=TU;DTSTART=19970902T010000Z","RRULE:FREQ=YEARLY;COUNT=1;BYDAY=TH;DTSTART=19970902T010000Z"]
   */
  toString () {
    return JSON.stringify(this.valueOf())
  }

  _iter (iterResult: IterResult) {
    const _exdateHash: { [k: number]: boolean } = {}
    const _exrule = this._exrule
    const _accept = iterResult.accept

    function evalExdate (after: Date, before: Date) {
      _exrule.forEach(function (rrule) {
        rrule.between(after, before, true).forEach(function (date) {
          _exdateHash[Number(date)] = true
        })
      })
    }

    this._exdate.forEach(function (date) {
      _exdateHash[Number(date)] = true
    })

    iterResult.accept = function (date) {
      const dt = Number(date)
      if (!_exdateHash[dt]) {
        evalExdate(new Date(dt - 1), new Date(dt + 1))
        if (!_exdateHash[dt]) {
          _exdateHash[dt] = true
          return _accept.call(this, date)
        }
      }
      return true
    }

    if (iterResult.method === 'between') {
      evalExdate(iterResult.args.after!, iterResult.args.before!)
      iterResult.accept = function (date) {
        const dt = Number(date)
        if (!_exdateHash[dt]) {
          _exdateHash[dt] = true
          return _accept.call(this, date)
        }
        return true
      }
    }

    for (let i = 0; i < this._rdate.length; i++) {
      if (!iterResult.accept(new Date(this._rdate[i].getTime()))) break
    }

    this._rrule.forEach(function (rrule) {
      rrule._iter(iterResult)
    })

    const res = iterResult._result
    dateutil.sort(res)
    switch (iterResult.method) {
      case 'all':
      case 'between':
        return res
      case 'before':
        return (res.length && res[res.length - 1]) || null
      case 'after':
        return (res.length && res[0]) || null
      default:
        return null
    }
  }

  /**
   * Create a new RRuleSet Object completely base on current instance
   */
  clone (): RRuleSet {
    const rrs = new RRuleSet(!!this._cache)
    let i
    for (i = 0; i < this._rrule.length; i++) {
      rrs.rrule(this._rrule[i].clone())
    }
    for (i = 0; i < this._rdate.length; i++) {
      rrs.rdate(new Date(this._rdate[i].getTime()))
    }
    for (i = 0; i < this._exrule.length; i++) {
      rrs.exrule(this._exrule[i].clone())
    }
    for (i = 0; i < this._exdate.length; i++) {
      rrs.exdate(new Date(this._exdate[i].getTime()))
    }
    return rrs
  }
}
