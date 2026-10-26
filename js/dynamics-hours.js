// Direct V58 hourly selector: scoredAt timestamps, Moscow UTC+3, no day normalization.
export function hourBins(events,judge=''){
 const bins=Array(24).fill(0);
 for(const event of events){if((!judge||event.judge===judge)&&Number.isFinite(event.t))bins[new Date(event.t+10800000).getUTCHours()]++;}
 return bins;
}
