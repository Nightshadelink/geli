import {IDirectory} from '../../../../shared/models/mediaManager/IDirectory';
import {File} from './File';
import * as mongoose from 'mongoose';
import {Unit} from '../units/Unit';

interface IDirectoryModel extends IDirectory, mongoose.Document {

}

const directorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  subDirectories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Directory'
    }
  ],
  files: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File'
    }
  ]
}, {
  timestamps: true,
  toObject: {
    transform: function (doc: IDirectoryModel, ret: any) {
      ret._id = ret._id.toString();
      ret.subDirectories = ret.subDirectories.map((dir: any) => {
        if (!dir._id) {
          dir = dir.toString();
        }
        return dir;
      });
      ret.files = ret.files.map((file: any) => {
        if (!file._id) {
          file = file.toString();
        }
        return file;
      });
    }
  },
});

directorySchema.pre('remove', async function () {
  const localDir = <IDirectoryModel><any>this;
  try {
    for (const subdir of localDir.subDirectories) {
      // linting won't let us use 'Directory' before it is actually declared
      // tslint:disable-next-line:no-use-before-declare
      const model = await Directory.findById(subdir);
      if (model) {
        await model.remove();
      }
    }
    await Unit.deleteMany({'_id': {$in: localDir.files}}).exec();
  } catch (err) {
    throw new Error('Delete Error: ' + err.toString());
  }
});

const Directory = mongoose.model<IDirectoryModel>('Directory', directorySchema);

export {Directory, IDirectoryModel};
