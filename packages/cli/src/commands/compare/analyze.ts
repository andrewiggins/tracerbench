/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable filenames/match-exported */
import { IConfig } from "@oclif/config";
import * as Parser from "@oclif/parser";

import { TBBaseCommand } from "../../command-config";
import { fidelityLookup } from "../../command-config/default-flag-args";
import { CompareResults } from "../../compare/compare-results";
import {
  GenerateStats,
  ParsedTitleConfigs,
} from "../../compare/generate-stats";
import parseCompareResult from "../../compare/parse-compare-result";
import { resultsFile } from "../../helpers/args";
import { fidelity, isCIEnv, regressionThreshold } from "../../helpers/flags";
export interface CompareAnalyzeFlags {
  fidelity: number;
  regressionThreshold: number;
  isCIEnv: boolean;
}

export default class CompareAnalyze extends TBBaseCommand {
  public static description = `Generates stdout report from the "tracerbench compare" command output, 'compare.json'`;

  public static args = [resultsFile];
  public static flags = {
    fidelity: fidelity({ required: true }),
    regressionThreshold: regressionThreshold({ required: true }),
    isCIEnv: isCIEnv({ required: true }),
  };
  public typedFlags: CompareAnalyzeFlags;
  constructor(argv: string[], config: IConfig) {
    super(argv, config);
    this.typedFlags = this.parseFlags(CompareAnalyze);
  }

  private parseFlags(CompareAnalyze: Parser.Input<any>): CompareAnalyzeFlags {
    const { flags } = this.parse(CompareAnalyze);
    const { isCIEnv } = flags;
    let { regressionThreshold, fidelity } = flags;

    if (typeof regressionThreshold === "string") {
      regressionThreshold = parseInt(regressionThreshold, 10);
    }

    if (typeof fidelity === "string") {
      // integers are coming as string from oclif
      if (Number.isInteger(parseInt(fidelity, 10))) {
        fidelity = parseInt(fidelity, 10);
      }
      // is a string and is either test/low/med/high
      if (Object.keys(fidelityLookup).includes(fidelity)) {
        fidelity = parseInt((fidelityLookup as any)[fidelity], 10);
      }
    }

    return {
      fidelity,
      regressionThreshold,
      isCIEnv,
    };
  }

  public async run(): Promise<string> {
    const { args } = this.parse(CompareAnalyze);
    const { controlData, experimentData } = parseCompareResult(
      args.resultsFile
    );
    const reportTitles = this.getReportTitles(
      "TracerBench",
      controlData.meta.browserVersion
    );

    // generate all relevant statistics from the compare.json resultsFile
    const stats = new GenerateStats(controlData, experimentData, reportTitles);
    const compareResults = new CompareResults(
      stats,
      this.typedFlags.fidelity,
      this.typedFlags.regressionThreshold
    );

    if (!this.typedFlags.isCIEnv) {
      // then log the tables
      compareResults.logTables();
    }

    compareResults.logSummary();

    // return the Stringified<ICompareJSONResults> stat summary report
    return compareResults.stringifyJSON();
  }

  private getReportTitles(
    plotTitle: string,
    browserVersion: string
  ): ParsedTitleConfigs {
    return {
      servers: [{ name: "Control" }, { name: "Experiment" }],
      plotTitle,
      browserVersion,
    };
  }
}
