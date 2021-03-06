import * as Debug from "debug";
const debug = Debug("zamza:model:lockmodel");
import * as uuid from "uuid";
import * as moment from "moment";

import Zamza from "../../Zamza";
import { Metrics } from "../../Metrics";

export class LockModel {

    public readonly metrics: Metrics;
    public readonly name: string;
    private model: any;
    public readonly instanceId: string;

    constructor(zamza: Zamza) {
        this.metrics = zamza.metrics;
        this.name = "lock";
        this.model = null;
        this.instanceId = uuid.v4();
        debug("Generated instance id", this.instanceId);
    }

    public registerModel(mongoose: any, schemaConstructor: any) {

        const schemaDefinition = {
            name: String,
            instanceId: String,
            timestamp: Number,
        };

        const schema = new schemaConstructor(schemaDefinition);

         // single index
        schema.index({ name: 1 }, { unique: true });

        // compound index
        schema.index({ name: 1, timestamp: 1 }, { unique: false });
        schema.index({ name: 1, timestamp: 1, instanceId: 1 }, { unique: false });

        this.model = mongoose.model(this.name, schema);

        this.model.on("index", (error: Error) => {

            if (error) {
                debug("Index creation failed", error.message);
            } else {
                debug("Index creation successfull.");
            }
        });

        debug("Registered model with schema.");
    }

    public async getLock(name: string, timeout: number = 25000): Promise<boolean> {

        let lock;
        try {
          lock = await this.model.findOneAndUpdate({
            name,
            timestamp : { $lte : moment().valueOf() },
          }, {
            instanceId: this.instanceId,
            timestamp: moment().valueOf() + timeout,
          }, {
            upsert: true,
            new: true,
          });
        } catch (error) {

          // duplicated key, happens when multiple clients access resource at the same time
          if (error.code === 11000) {
            this.metrics.inc("mongo_lock_miss");
            return false;
          }

          // other error
          throw error;
        }

        if (lock && lock.instanceId === this.instanceId) {
            this.metrics.inc("mongo_lock_hit");
            return true;
        } else {
            this.metrics.inc("mongo_lock_miss");
            return false;
        }
      }

      public async extendLock(name: string, extendFor: number = 25000): Promise<boolean> {

        let lock;
        try {
          lock = await this.model.findOneAndUpdate({
            name,
            timestamp : { $gte : moment().valueOf() },
            instanceId: this.instanceId,
          }, {
            $inc: {
              timestamp: extendFor,
            },
          }, {
            new: true,
          });
        } catch (error) {

          // duplicated key, happens when multiple clients access resource at the same time
          if (error.code === 11000) {
            this.metrics.inc("mongo_lock_extend_miss");
            return false;
          }

          // other error
          throw error;
        }

        if (lock) {
            this.metrics.inc("mongo_lock_extend_hit");
            return true;
        } else {
            this.metrics.inc("mongo_lock_extend_miss");
            return false;
        }
      }

      public async removeLock(name: string): Promise<any> {

        const { n } = await this.model.deleteOne({
          name,
          instanceId: this.instanceId,
          timestamp : { $gte : moment().valueOf() },
        });

        if (n === 1) {
            this.metrics.inc("mongo_lock_removed");
            return true;
        } else {
            this.metrics.inc("mongo_lock_remove_failed");
            return false;
        }
      }

    public delete(name: string) {
        return this.model.deleteMany({name}).exec();
    }

    public truncateCollection() {
        debug("Truncating collection");
        return this.model.deleteMany({}).exec();
    }
}
